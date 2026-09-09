import { describe, expect, it, vi } from 'vite-plus/test';

import {
  documentConflict,
  type DocumentEditorState,
  type DocumentTextSource,
} from '@/features/documents/domain/document';
import { documentQueryScope, sourceApi, textSource } from '@/test/fakes/documents';

import { createDocumentRuntime, type DocumentRuntime } from './document-runtime';
import { DOCUMENT_OVERWRITE_MESSAGES } from './failure-messages';
import { DocumentSaveError, type DocumentSourcePort } from './ports';

/** The editor a live runtime holds; every conflict assertion needs it. */
function editorOf(runtime: DocumentRuntime): DocumentEditorState {
  const editor = runtime.store.getState().editor;
  if (!editor) throw new Error('The runtime has no editor state.');
  return editor;
}

function missingSaveSettlement(): never {
  throw new Error('First save did not start.');
}

function conflictingSave(): DocumentSourcePort['save'] {
  return vi.fn(async () => {
    throw new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' });
  });
}

describe('Document runtime', () => {
  it('accepts only completions for its live source generation', () => {
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 4,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const completion = vi.fn();

    const captured = runtime.capture();
    expect(runtime.accept(captured, completion)).toBe(true);
    expect(
      runtime.accept(
        {
          ...captured,
          scope: {
            ...captured.scope,
            source: { folderPath: '/library/archive', path: 'plan.md' },
          },
        },
        completion,
      ),
    ).toBe(false);
    expect(completion).toHaveBeenCalledOnce();
  });

  it('refuses a completion for work retired while it was in flight', () => {
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    // Captured the way a save takes its token before its first await.
    const captured = runtime.capture();
    const completion = vi.fn();

    runtime.retireOperations();

    expect(runtime.accept(captured, completion)).toBe(false);
    expect(completion).not.toHaveBeenCalled();
    // The document stays open, so work started afterwards still lands.
    expect(runtime.accept(runtime.capture(), completion)).toBe(true);
    expect(completion).toHaveBeenCalledOnce();
  });

  it('cancels owned work and rejects stale completions after disposal', () => {
    const queries = documentQueryScope();
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries,
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const capturedScope = runtime.capture();
    const completion = vi.fn();

    runtime.dispose();
    runtime.dispose();

    expect(runtime.signal.aborted).toBe(true);
    expect(runtime.store.getState().lifecycle).toBe('disposed');
    expect(runtime.accept(capturedScope, completion)).toBe(false);
    expect(completion).not.toHaveBeenCalled();
    expect(queries.cancel).toHaveBeenCalledOnce();
    expect(queries.remove).toHaveBeenCalledOnce();
  });

  it('keeps a document from another member folder read-only', () => {
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/archive', path: 'plan.md' },
    });

    expect(runtime.store.getState().access).toBe('read-only');
  });

  it('saves the live draft against its accepted version and reconciles authority', async () => {
    const queries = documentQueryScope();
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries,
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const api = sourceApi({
      save: vi.fn(async () => textSource({ content: 'changed\r\n', version: 'v2' })),
    });
    runtime.reconcile(textSource({ content: 'before\r\n' }));
    runtime.change('changed\n');

    await expect(runtime.save(api)).resolves.toBe(true);

    expect(api.save).toHaveBeenCalledWith(
      runtime.scope.source,
      { baseVersion: 'v1', content: 'changed\n' },
      runtime.signal,
    );
    expect(runtime.store.getState().editor).toMatchObject({
      baseline: 'changed\n',
      save: { kind: 'saved' },
      value: 'changed\n',
      version: 'v2',
    });
    expect(queries.replaceSource).toHaveBeenCalledWith({
      content: 'changed\r\n',
      format: 'md',
      version: 'v2',
    });
  });

  it('does not call the save authority for a clean no-op', async () => {
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const api = sourceApi();
    runtime.reconcile(textSource({ content: 'same' }));
    runtime.change('different');
    runtime.change('same');

    await expect(runtime.save(api)).resolves.toBe(true);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('keeps the dirty draft and expected version after a conflict', async () => {
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'newer disk', version: 'v2' })),
      save: vi.fn(async () => {
        throw new DocumentSaveError('conflict', 'The file changed on disk.', {
          currentVersion: 'v2',
        });
      }),
    });
    runtime.reconcile(textSource({ content: 'before' }));
    runtime.change('recoverable draft');

    await expect(runtime.save(api)).resolves.toBe(false);
    expect(runtime.store.getState().editor).toMatchObject({
      save: {
        conflict: {
          diskContent: 'newer disk',
          diskVersion: 'v2',
          editorContent: 'recoverable draft',
          resolving: null,
        },
        kind: 'conflict',
      },
      value: 'recoverable draft',
      version: 'v1',
    });
  });

  it('captures typing completed while the stale save and disk read are in flight', async () => {
    let finishLoad: (source: DocumentTextSource) => void = missingSaveSettlement;
    const api = sourceApi({
      load: vi.fn<DocumentSourcePort['load']>(
        () =>
          new Promise((resolve) => {
            finishLoad = resolve;
          }),
      ),
      save: conflictingSave(),
    });
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile(textSource({ content: 'before' }));
    runtime.change('first draft');

    const saving = runtime.save(api);
    await vi.waitFor(() => expect(api.load).toHaveBeenCalledOnce());
    runtime.change('latest draft');
    finishLoad(textSource({ content: 'disk source', version: 'v2' }));

    await expect(saving).resolves.toBe(false);
    expect(documentConflict(editorOf(runtime))?.editorContent).toBe('latest draft');
  });

  it('reloads the captured disk snapshot and clears the failed barrier', async () => {
    const queries = documentQueryScope();
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'disk source', version: 'v2' })),
      save: conflictingSave(),
    });
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries,
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile(textSource({ content: 'before' }));
    runtime.change('editor draft');
    await runtime.save(api);

    await expect(runtime.resolveConflict(api, 'reload')).resolves.toBe(true);
    expect(runtime.store.getState().editor).toMatchObject({
      baseline: 'disk source',
      save: { kind: 'clean' },
      value: 'disk source',
      version: 'v2',
    });
    expect(queries.replaceSource).toHaveBeenLastCalledWith({
      content: 'disk source',
      format: 'md',
      version: 'v2',
    });
  });

  it('turns merge into a dirty draft based on the disk snapshot', async () => {
    const save = vi
      .fn<DocumentSourcePort['save']>()
      .mockRejectedValueOnce(new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' }))
      .mockResolvedValueOnce(textSource({ content: 'merged', version: 'v3' }));
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'shared\ndisk', version: 'v2' })),
      save,
    });
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile(textSource({ content: 'shared\nbefore' }));
    runtime.change('shared\neditor');
    await runtime.save(api);

    await expect(runtime.resolveConflict(api, 'merge')).resolves.toBe(true);
    expect(runtime.store.getState().editor).toMatchObject({
      baseline: 'shared\ndisk',
      save: { kind: 'dirty' },
      value: [
        'shared',
        '<<<<<<< Editor Version',
        'editor',
        '=======',
        'disk',
        '>>>>>>> Disk Version',
      ].join('\n'),
      version: 'v2',
    });
    const mergedContent = runtime.store.getState().editor?.value ?? '';
    await expect(runtime.save(api)).resolves.toBe(true);
    expect(save).toHaveBeenLastCalledWith(
      runtime.scope.source,
      { baseVersion: 'v2', content: mergedContent },
      runtime.signal,
    );
  });

  it('gives one overwrite decision exclusive ownership until it settles', async () => {
    let finishOverwrite: (source: DocumentTextSource) => void = missingSaveSettlement;
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'disk source', version: 'v2' })),
      overwrite: vi.fn<DocumentSourcePort['overwrite']>(
        () =>
          new Promise((resolve) => {
            finishOverwrite = resolve;
          }),
      ),
      save: conflictingSave(),
    });
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile(textSource({ content: 'before' }));
    runtime.change('editor draft');
    await runtime.save(api);

    const overwrite = runtime.resolveConflict(api, 'overwrite');
    expect(documentConflict(editorOf(runtime))?.resolving).toBe('overwrite');
    await expect(runtime.resolveConflict(api, 'reload')).resolves.toBe(false);
    await expect(runtime.save(api)).resolves.toBe(false);
    finishOverwrite(textSource({ content: 'editor draft', version: 'v3' }));

    await expect(overwrite).resolves.toBe(true);
    expect(api.overwrite).toHaveBeenCalledWith(
      runtime.scope.source,
      { content: 'editor draft' },
      runtime.signal,
    );
    expect(runtime.store.getState().editor).toMatchObject({
      save: { kind: 'saved' },
      value: 'editor draft',
      version: 'v3',
    });
  });

  it('keeps both versions and releases the decision after overwrite fails', async () => {
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'disk source', version: 'v2' })),
      overwrite: vi.fn<DocumentSourcePort['overwrite']>(async () => {
        throw new DocumentSaveError('unavailable', 'HTTP 503 from /api/files');
      }),
      save: conflictingSave(),
    });
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile(textSource({ content: 'before' }));
    runtime.change('editor draft');
    await runtime.save(api);

    await expect(runtime.resolveConflict(api, 'overwrite')).resolves.toBe(false);
    expect(runtime.store.getState().editor).toMatchObject({
      save: {
        conflict: {
          diskContent: 'disk source',
          editorContent: 'editor draft',
          resolving: null,
        },
        kind: 'conflict',
      },
    });
    expect(documentConflict(editorOf(runtime))?.resolutionMessage).toBe(
      DOCUMENT_OVERWRITE_MESSAGES.unavailable,
    );
    await expect(runtime.resolveConflict(api, 'reload')).resolves.toBe(true);
  });

  it('preserves newer typing and drains a queued save against the accepted result', async () => {
    let settleFirst: (value: DocumentTextSource) => void = missingSaveSettlement;
    const save = vi
      .fn<DocumentSourcePort['save']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settleFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(textSource({ content: 'second', version: 'v3' }));
    const api = sourceApi({ save });
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: documentQueryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile(textSource({ content: 'before' }));
    runtime.change('first');
    const first = runtime.save(api);
    runtime.change('second');
    const second = runtime.save(api);
    settleFirst(textSource({ content: 'first', version: 'v2' }));

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(save).toHaveBeenNthCalledWith(
      2,
      runtime.scope.source,
      { baseVersion: 'v2', content: 'second' },
      runtime.signal,
    );
    expect(runtime.store.getState().editor).toMatchObject({
      save: { kind: 'saved' },
      value: 'second',
      version: 'v3',
    });
  });
});

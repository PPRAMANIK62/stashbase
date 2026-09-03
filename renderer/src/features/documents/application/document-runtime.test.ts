import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from './document-runtime';
import { DocumentSaveError, type DocumentSourceApi } from './ports';

function queryScope() {
  return { cancel: vi.fn(async () => undefined), remove: vi.fn(), replaceSource: vi.fn() };
}

function missingSaveSettlement(): never {
  throw new Error('First save did not start.');
}

describe('Document runtime', () => {
  it('accepts only completions for its live source generation', () => {
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 4,
      id: 'tab-1',
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const completion = vi.fn();

    expect(runtime.accept(runtime.scope, completion)).toBe(true);
    expect(
      runtime.accept(
        {
          ...runtime.scope,
          source: { folderPath: '/library/archive', path: 'plan.md' },
        },
        completion,
      ),
    ).toBe(false);
    expect(completion).toHaveBeenCalledOnce();
  });

  it('cancels owned work and rejects stale completions after disposal', () => {
    const queries = queryScope();
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries,
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const capturedScope = runtime.scope;
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
      queries: queryScope(),
      source: { folderPath: '/library/archive', path: 'plan.md' },
    });

    expect(runtime.store.getState().access).toBe('read-only');
  });

  it('saves the live draft against its accepted version and reconciles authority', async () => {
    const queries = queryScope();
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries,
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const api: DocumentSourceApi = {
      load: vi.fn(),
      overwrite: vi.fn(),
      save: vi.fn<DocumentSourceApi['save']>(async () => ({
        content: 'changed\r\n',
        format: 'md',
        version: 'v2',
      })),
    };
    runtime.reconcile({ content: 'before\r\n', format: 'md', version: 'v1' });
    runtime.change('changed\n');

    await expect(runtime.save(api)).resolves.toBe(true);

    expect(api.save).toHaveBeenCalledWith(
      runtime.scope.source,
      { baseVersion: 'v1', content: 'changed\n' },
      runtime.signal,
    );
    expect(runtime.store.getState().editor).toMatchObject({
      baseline: 'changed\n',
      dirty: false,
      savePhase: 'saved',
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
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const api: DocumentSourceApi = { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() };
    runtime.reconcile({ content: 'same', format: 'md', version: 'v1' });
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
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    const api: DocumentSourceApi = {
      load: vi.fn(async () => ({ content: 'newer disk', format: 'md' as const, version: 'v2' })),
      overwrite: vi.fn(),
      save: vi.fn(async () => {
        throw new DocumentSaveError('conflict', 'The file changed on disk.', {
          currentVersion: 'v2',
        });
      }),
    };
    runtime.reconcile({ content: 'before', format: 'md', version: 'v1' });
    runtime.change('recoverable draft');

    await expect(runtime.save(api)).resolves.toBe(false);
    expect(runtime.store.getState().editor).toMatchObject({
      conflict: {
        diskContent: 'newer disk',
        diskVersion: 'v2',
        editorContent: 'recoverable draft',
        resolving: null,
      },
      conflictVersion: 'v2',
      dirty: true,
      savePhase: 'conflict',
      value: 'recoverable draft',
      version: 'v1',
    });
  });

  it('captures typing completed while the stale save and disk read are in flight', async () => {
    let finishLoad: (source: { content: string; format: 'md'; version: string }) => void =
      missingSaveSettlement;
    const api: DocumentSourceApi = {
      load: vi.fn<DocumentSourceApi['load']>(
        () =>
          new Promise((resolve) => {
            finishLoad = resolve;
          }),
      ),
      overwrite: vi.fn(),
      save: vi.fn(async () => {
        throw new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' });
      }),
    };
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile({ content: 'before', format: 'md', version: 'v1' });
    runtime.change('first draft');

    const saving = runtime.save(api);
    await vi.waitFor(() => expect(api.load).toHaveBeenCalledOnce());
    runtime.change('latest draft');
    finishLoad({ content: 'disk source', format: 'md', version: 'v2' });

    await expect(saving).resolves.toBe(false);
    expect(runtime.store.getState().editor?.conflict?.editorContent).toBe('latest draft');
  });

  it('reloads the captured disk snapshot and clears the failed barrier', async () => {
    const queries = queryScope();
    const api: DocumentSourceApi = {
      load: vi.fn<DocumentSourceApi['load']>(async () => ({
        content: 'disk source',
        format: 'md',
        version: 'v2',
      })),
      overwrite: vi.fn(),
      save: vi.fn(async () => {
        throw new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' });
      }),
    };
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries,
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile({ content: 'before', format: 'md', version: 'v1' });
    runtime.change('editor draft');
    await runtime.save(api);

    await expect(runtime.resolveConflict(api, 'reload')).resolves.toBe(true);
    expect(runtime.store.getState().editor).toMatchObject({
      baseline: 'disk source',
      conflict: null,
      dirty: false,
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
      .fn<DocumentSourceApi['save']>()
      .mockRejectedValueOnce(new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' }))
      .mockResolvedValueOnce({ content: 'merged', format: 'md', version: 'v3' });
    const api: DocumentSourceApi = {
      load: vi.fn<DocumentSourceApi['load']>(async () => ({
        content: 'shared\ndisk',
        format: 'md',
        version: 'v2',
      })),
      overwrite: vi.fn(),
      save,
    };
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile({ content: 'shared\nbefore', format: 'md', version: 'v1' });
    runtime.change('shared\neditor');
    await runtime.save(api);

    await expect(runtime.resolveConflict(api, 'merge')).resolves.toBe(true);
    expect(runtime.store.getState().editor).toMatchObject({
      baseline: 'shared\ndisk',
      conflict: null,
      dirty: true,
      savePhase: 'unsaved',
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
    let finishOverwrite: (source: { content: string; format: 'md'; version: string }) => void =
      missingSaveSettlement;
    const api: DocumentSourceApi = {
      load: vi.fn<DocumentSourceApi['load']>(async () => ({
        content: 'disk source',
        format: 'md',
        version: 'v2',
      })),
      overwrite: vi.fn<DocumentSourceApi['overwrite']>(
        () =>
          new Promise((resolve) => {
            finishOverwrite = resolve;
          }),
      ),
      save: vi.fn(async () => {
        throw new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' });
      }),
    };
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile({ content: 'before', format: 'md', version: 'v1' });
    runtime.change('editor draft');
    await runtime.save(api);

    const overwrite = runtime.resolveConflict(api, 'overwrite');
    expect(runtime.store.getState().editor?.conflict?.resolving).toBe('overwrite');
    await expect(runtime.resolveConflict(api, 'reload')).resolves.toBe(false);
    await expect(runtime.save(api)).resolves.toBe(false);
    finishOverwrite({ content: 'editor draft', format: 'md', version: 'v3' });

    await expect(overwrite).resolves.toBe(true);
    expect(api.overwrite).toHaveBeenCalledWith(
      runtime.scope.source,
      { content: 'editor draft' },
      runtime.signal,
    );
    expect(runtime.store.getState().editor).toMatchObject({
      conflict: null,
      dirty: false,
      value: 'editor draft',
      version: 'v3',
    });
  });

  it('keeps both versions and releases the decision after overwrite fails', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn<DocumentSourceApi['load']>(async () => ({
        content: 'disk source',
        format: 'md',
        version: 'v2',
      })),
      overwrite: vi.fn<DocumentSourceApi['overwrite']>(async () => {
        throw new DocumentSaveError('unavailable', 'The overwrite failed.');
      }),
      save: vi.fn(async () => {
        throw new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' });
      }),
    };
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile({ content: 'before', format: 'md', version: 'v1' });
    runtime.change('editor draft');
    await runtime.save(api);

    await expect(runtime.resolveConflict(api, 'overwrite')).resolves.toBe(false);
    expect(runtime.store.getState().editor).toMatchObject({
      conflict: {
        diskContent: 'disk source',
        editorContent: 'editor draft',
        resolving: null,
      },
      dirty: true,
      saveMessage: 'The overwrite failed.',
      savePhase: 'conflict',
    });
    await expect(runtime.resolveConflict(api, 'reload')).resolves.toBe(true);
  });

  it('preserves newer typing and drains a queued save against the accepted result', async () => {
    let settleFirst: (value: { content: string; format: 'md'; version: string }) => void =
      missingSaveSettlement;
    const save = vi
      .fn<DocumentSourceApi['save']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settleFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ content: 'second', format: 'md', version: 'v3' });
    const api: DocumentSourceApi = { load: vi.fn(), overwrite: vi.fn(), save };
    const runtime = createDocumentRuntime({
      activeFolderPath: '/library/notes',
      generation: 1,
      id: 'tab-1',
      queries: queryScope(),
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
    runtime.reconcile({ content: 'before', format: 'md', version: 'v1' });
    runtime.change('first');
    const first = runtime.save(api);
    runtime.change('second');
    const second = runtime.save(api);
    settleFirst({ content: 'first', format: 'md', version: 'v2' });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(save).toHaveBeenNthCalledWith(
      2,
      runtime.scope.source,
      { baseVersion: 'v2', content: 'second' },
      runtime.signal,
    );
    expect(runtime.store.getState().editor).toMatchObject({
      dirty: false,
      value: 'second',
      version: 'v3',
    });
  });
});

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
    const api: DocumentSourceApi = { load: vi.fn(), save: vi.fn() };
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
      load: vi.fn(),
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
      conflictVersion: 'v2',
      dirty: true,
      savePhase: 'conflict',
      value: 'recoverable draft',
      version: 'v1',
    });
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
    const api: DocumentSourceApi = { load: vi.fn(), save };
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

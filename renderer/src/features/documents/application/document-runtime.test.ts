import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from './document-runtime';

function queryScope() {
  return { cancel: vi.fn(async () => undefined), remove: vi.fn() };
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
});

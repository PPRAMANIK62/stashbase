import { describe, expect, it, vi } from 'vite-plus/test';

import { createWorkspaceRuntime } from './runtime';

describe('Workspace runtime', () => {
  it('rejects an invalid runtime generation at construction', () => {
    expect(() =>
      createWorkspaceRuntime({
        folder: { name: 'Notes', path: '/library/notes' },
        generation: 0,
        queries: { cancel: vi.fn(async () => undefined) },
      }),
    ).toThrow('Workspace runtime generation must be a positive safe integer.');
  });

  it('owns one folder generation and accepts only its current completions', () => {
    const queries = { cancel: vi.fn(async () => undefined) };
    const runtime = createWorkspaceRuntime({
      folder: { name: 'Notes', path: '/library/notes' },
      generation: 7,
      queries,
    });
    const completion = vi.fn();

    expect(runtime.store.getState()).toEqual({
      expanded: {},
      lifecycle: 'active',
      selectedPath: null,
      scope: {
        folder: { name: 'Notes', path: '/library/notes' },
        generation: 7,
      },
    });
    expect(runtime.accept(runtime.scope, completion)).toBe(true);
    expect(completion).toHaveBeenCalledOnce();

    expect(
      runtime.accept(
        { folder: runtime.scope.folder, generation: runtime.scope.generation - 1 },
        completion,
      ),
    ).toBe(false);
    expect(
      runtime.accept(
        {
          folder: { name: 'Writing', path: '/library/writing' },
          generation: runtime.scope.generation,
        },
        completion,
      ),
    ).toBe(false);
    expect(completion).toHaveBeenCalledOnce();
  });

  it('aborts work, retires state, and cancels queries exactly once on disposal', () => {
    const queries = { cancel: vi.fn(async () => undefined) };
    const runtime = createWorkspaceRuntime({
      folder: { name: 'Notes', path: '/library/notes' },
      generation: 1,
      queries,
    });
    const capturedScope = runtime.scope;
    const lateCompletion = vi.fn();

    runtime.dispose();
    runtime.dispose();

    expect(runtime.signal.aborted).toBe(true);
    expect(runtime.store.getState().lifecycle).toBe('disposed');
    expect(queries.cancel).toHaveBeenCalledOnce();
    expect(runtime.accept(capturedScope, lateCompletion)).toBe(false);
    expect(lateCompletion).not.toHaveBeenCalled();
  });
});

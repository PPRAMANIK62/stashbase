import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from './document-runtime';

describe('Document runtime', () => {
  it('accepts only completions for its live source generation', () => {
    const runtime = createDocumentRuntime({
      generation: 4,
      id: 'tab-1',
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
    const runtime = createDocumentRuntime({
      generation: 1,
      id: 'tab-1',
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
  });
});

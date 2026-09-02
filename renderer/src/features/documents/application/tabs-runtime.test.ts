import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime } from './tabs-runtime';

function idFactory() {
  let next = 0;
  return () => `tab-${++next}`;
}

describe('Document tabs runtime', () => {
  it('restores fresh document runtimes and one active source', () => {
    const runtime = createDocumentTabsRuntime({
      createId: idFactory(),
      folderPath: '/library/notes',
      generation: 3,
      restored: {
        activeTabId: 'tab-plan',
        tabs: [
          {
            id: 'tab-plan',
            source: { folderPath: '/library/notes', path: 'plan.md' },
          },
        ],
      },
    });

    expect(runtime.store.getState().activeTabId).toBe('tab-plan');
    expect(runtime.getDocument('tab-plan')?.scope).toEqual({
      generation: 1,
      id: 'tab-plan',
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
  });

  it('makes the runtime collection the duplicate-open authority', () => {
    const createId = vi.fn(idFactory());
    const runtime = createDocumentTabsRuntime({
      createId,
      folderPath: '/library/notes',
      generation: 1,
    });
    const source = { folderPath: '/library/notes', path: 'plan.md' };

    const first = runtime.open(source);
    const repeated = runtime.open({ ...source });

    expect(repeated).toBe(first);
    expect(runtime.store.getState().tabs).toHaveLength(1);
    expect(createId).toHaveBeenCalledOnce();
  });

  it('cancels only the closed document and rejects its stale work', () => {
    const runtime = createDocumentTabsRuntime({
      createId: idFactory(),
      folderPath: '/library/notes',
      generation: 1,
    });
    const first = runtime.open({ folderPath: '/library/notes', path: 'one.md' });
    const second = runtime.open({ folderPath: '/library/notes', path: 'two.md' });
    const capturedScope = first?.scope;
    const completion = vi.fn();

    runtime.close('tab-1');

    expect(first?.signal.aborted).toBe(true);
    expect(second?.signal.aborted).toBe(false);
    expect(capturedScope && first?.accept(capturedScope, completion)).toBe(false);
    expect(runtime.store.getState().activeTabId).toBe('tab-2');
  });

  it('disposes every child and rejects completions from an older folder scope', () => {
    const runtime = createDocumentTabsRuntime({
      createId: idFactory(),
      folderPath: '/library/notes',
      generation: 2,
    });
    const document = runtime.open({ folderPath: '/library/notes', path: 'one.md' });
    const completion = vi.fn();

    expect(runtime.accept({ folderPath: '/library/notes', generation: 1 }, completion)).toBe(false);
    runtime.dispose();
    runtime.dispose();

    expect(runtime.signal.aborted).toBe(true);
    expect(document?.signal.aborted).toBe(true);
    expect(runtime.store.getState().lifecycle).toBe('disposed');
    expect(runtime.accept(runtime.scope, completion)).toBe(false);
    expect(completion).not.toHaveBeenCalled();
  });

  it('projects only active-folder relative identities for Workspace persistence', () => {
    const runtime = createDocumentTabsRuntime({
      createId: idFactory(),
      folderPath: '/library/notes',
      generation: 1,
    });
    runtime.open({ folderPath: '/library/notes', path: 'inside.md' });
    runtime.open({ folderPath: '/library/archive', path: 'outside.md' });

    const persisted = runtime.toSession();
    expect(persisted.tabs).toEqual([{ id: 'tab-1', path: 'inside.md' }]);
    expect(persisted.activeTabId).toBeNull();
  });
});

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createWorkspaceRuntime } from '@/features/workspace/application/runtime';
import { listing, listingFolder, workspaceRuntimeOptions } from '@/test/fakes/workspace';

import { useTree } from './use-tree';

const RESEARCH = listing(['notes.md', 'docs/plan.md'], ['docs', listingFolder({ path: 'vendor' })]);

function treeHook() {
  const runtime = createWorkspaceRuntime(workspaceRuntimeOptions());
  const hook = renderHook(() => useTree(runtime, RESEARCH));
  return { hook, runtime };
}

afterEach(cleanup);

describe('tree state', () => {
  it('shows only the rows an open folder reveals', () => {
    const { hook } = treeHook();

    expect(hook.result.current.rows.map((row) => row.node.path)).toEqual([
      'docs',
      'vendor',
      'notes.md',
    ]);

    act(() => hook.result.current.toggle('docs'));
    expect(hook.result.current.rows.map((row) => row.node.path)).toEqual([
      'docs',
      'docs/plan.md',
      'vendor',
      'notes.md',
    ]);

    act(() => hook.result.current.select('docs/plan.md'));
    expect(hook.result.current.selectedPath).toBe('docs/plan.md');

    act(() => hook.result.current.toggle('docs'));
    expect(hook.result.current.expanded).toEqual({});
  });

  it('drops a row gesture that lands after its folder scope is gone', () => {
    const { hook, runtime } = treeHook();

    act(() => runtime.dispose());
    act(() => hook.result.current.select('notes.md'));
    act(() => hook.result.current.toggle('docs'));

    expect(runtime.store.getState().selectedPath).toBeNull();
    expect(runtime.store.getState().expanded).toEqual({});
    expect(runtime.store.getState().lifecycle).toBe('disposed');
  });
});

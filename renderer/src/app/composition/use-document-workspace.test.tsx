import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  createWorkspaceRuntime,
  createWorkspaceSessionRuntime,
  type FolderSessionState,
} from '@/features/workspace/public';

import { useDocumentWorkspace } from './use-document-workspace';

const restored: FolderSessionState = {
  activeTabId: 'restored-tab',
  expandedPaths: [],
  folderPath: '/library/notes',
  selectedPath: null,
  tabs: [{ id: 'restored-tab', path: 'plan.md' }],
};

describe('document workspace composition', () => {
  it('hydrates document identities, records tab changes, and disposes with the folder scope', async () => {
    const save = vi.fn(async () => undefined);
    const session = createWorkspaceSessionRuntime({ load: async () => null, save });
    await session.restore();
    session.setActiveFolder('/library/notes');
    const workspace = createWorkspaceRuntime({
      folder: { name: 'Notes', path: '/library/notes' },
      generation: 2,
      queries: { cancel: vi.fn(async () => undefined), remove: vi.fn() },
    });
    let nextId = 0;
    const createId = () => `new-tab-${++nextId}`;

    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result, rerender } = renderHook(
      ({ currentWorkspace }) => useDocumentWorkspace(currentWorkspace, restored, session, createId),
      { initialProps: { currentWorkspace: workspace as typeof workspace | null }, wrapper },
    );

    expect(result.current?.store.getState().activeTabId).toBe('restored-tab');
    const restoredDocument = result.current?.getDocument('restored-tab');
    act(() => {
      result.current?.open({ folderPath: '/library/notes', path: 'other.md' });
    });
    await session.flush();

    expect(session.store.getState().snapshot.folders[0]?.tabs).toEqual([
      { id: 'restored-tab', path: 'plan.md' },
      { id: 'new-tab-1', path: 'other.md' },
    ]);

    rerender({ currentWorkspace: null });
    expect(restoredDocument?.signal.aborted).toBe(true);
  });
});

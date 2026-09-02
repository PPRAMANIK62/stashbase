import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { LibraryApi, LibraryLifecycle } from '@/features/workspace/application/ports';
import {
  createWorkspaceQueryScope,
  libraryQueryKey,
  workspaceQueryKeys,
} from '@/features/workspace/application/queries';
import { createWorkspaceRuntime } from '@/features/workspace/application/runtime';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { useLibraryLifecycle } from './use-library-lifecycle';

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function lifecycleHarness() {
  let removedHandler: ((folderPath: string) => void) | undefined;
  let prepareHandler: ((folderPath: string) => boolean | Promise<boolean>) | undefined;
  const lifecycle: LibraryLifecycle = {
    notifyFolderRemoved: vi.fn(async () => undefined),
    onFolderRemoved: vi.fn((handler) => {
      removedHandler = handler;
      return () => {
        removedHandler = undefined;
      };
    }),
    onPrepareFolderRemoval: vi.fn((handler) => {
      prepareHandler = handler;
      return () => {
        prepareHandler = undefined;
      };
    }),
    prepareFolderRemoval: vi.fn(),
    setActiveFolder: vi.fn(async () => undefined),
  };
  return {
    lifecycle,
    prepare: (folderPath: string) => prepareHandler?.(folderPath),
    remove: (folderPath: string) => removedHandler?.(folderPath),
  };
}

afterEach(cleanup);

describe('library lifecycle recovery', () => {
  it('retires only a removed folder runtime and evicts its scoped queries', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const active: LibrarySnapshot = {
      activeFolder: { name: 'Notes', path: '/library/notes' },
      homeDirectory: '/library',
      members: [{ favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: '/library/notes' }],
    };
    const removed = { ...active, activeFolder: null, members: [] };
    const api: LibraryApi = {
      load: vi.fn(async () => removed),
      openFolder: vi.fn(),
      removeFolder: vi.fn(),
    };
    const native = lifecycleHarness();
    const runtime = createWorkspaceRuntime({
      folder: active.activeFolder!,
      generation: 1,
      queries: createWorkspaceQueryScope(queryClient, '/library/notes'),
    });
    queryClient.setQueryData(libraryQueryKey, active);
    queryClient.setQueryData(workspaceQueryKeys.files('/library/notes'), { files: [] });
    queryClient.setQueryData(workspaceQueryKeys.files('/library/writing'), { files: [] });
    renderHook(() => useLibraryLifecycle(api, native.lifecycle, runtime), {
      wrapper: wrapper(queryClient),
    });

    expect(await native.prepare('/library/notes')).toBe(true);
    act(() => native.remove('/library/notes'));

    await waitFor(() => expect(runtime.signal.aborted).toBe(true));
    expect(queryClient.getQueryData(workspaceQueryKeys.files('/library/notes'))).toBeUndefined();
    expect(queryClient.getQueryData(workspaceQueryKeys.files('/library/writing'))).toEqual({
      files: [],
    });
    expect(queryClient.getQueryData(libraryQueryKey)).toEqual(removed);
  });

  it('rebinds a still-authorized folder after transient 412 context loss', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const active: LibrarySnapshot = {
      activeFolder: { name: 'Notes', path: '/library/notes' },
      homeDirectory: '/library',
      members: [{ favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: '/library/notes' }],
    };
    const membership = { ...active, activeFolder: null };
    const api: LibraryApi = {
      load: vi.fn(async () => membership),
      openFolder: vi.fn(async () => active),
      removeFolder: vi.fn(),
    };
    const native = lifecycleHarness();
    const runtime = createWorkspaceRuntime({
      folder: active.activeFolder!,
      generation: 4,
      queries: createWorkspaceQueryScope(queryClient, '/library/notes'),
    });
    const recovery = renderHook(() => useLibraryLifecycle(api, native.lifecycle, runtime), {
      wrapper: wrapper(queryClient),
    });

    act(() => recovery.result.current.recoverLostScope(runtime.scope));

    await waitFor(() => expect(api.openFolder).toHaveBeenCalledOnce());
    expect(api.openFolder).toHaveBeenCalledWith('/library/notes', expect.any(AbortSignal));
    expect(runtime.signal.aborted).toBe(false);
    expect(queryClient.getQueryData(libraryQueryKey)).toEqual(active);
  });

  it('evicts a disposed runtime when authoritative membership omits its folder', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const active: LibrarySnapshot = {
      activeFolder: { name: 'Notes', path: '/library/notes' },
      homeDirectory: '/library',
      members: [{ favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: '/library/notes' }],
    };
    const api: LibraryApi = {
      load: vi.fn(),
      openFolder: vi.fn(),
      removeFolder: vi.fn(),
    };
    const native = lifecycleHarness();
    const runtime = createWorkspaceRuntime({
      folder: active.activeFolder!,
      generation: 1,
      queries: createWorkspaceQueryScope(queryClient, '/library/notes'),
    });
    queryClient.setQueryData(libraryQueryKey, active);
    queryClient.setQueryData(workspaceQueryKeys.files('/library/notes'), { files: [] });
    const initialProps: {
      currentRuntime: ReturnType<typeof createWorkspaceRuntime> | null;
    } = { currentRuntime: runtime };
    const lifecycle = renderHook(
      ({ currentRuntime }: { currentRuntime: ReturnType<typeof createWorkspaceRuntime> | null }) =>
        useLibraryLifecycle(api, native.lifecycle, currentRuntime),
      { initialProps, wrapper: wrapper(queryClient) },
    );

    runtime.dispose();
    queryClient.setQueryData(libraryQueryKey, { ...active, activeFolder: null, members: [] });
    lifecycle.rerender({ currentRuntime: null });

    expect(queryClient.getQueryData(workspaceQueryKeys.files('/library/notes'))).toBeUndefined();
  });
});

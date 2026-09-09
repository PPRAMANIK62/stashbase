import type { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { LibraryLifecyclePort } from '@/features/workspace/application/ports';
import {
  createWorkspaceQueryScope,
  workspaceQueryKeys,
} from '@/features/workspace/application/queries';
import {
  createWorkspaceRuntime,
  type WorkspaceRuntime,
} from '@/features/workspace/application/runtime';
import type { ActiveLibraryFolder } from '@/features/workspace/domain/library';
import { libraryApi, librarySnapshot, workspaceRuntimeOptions } from '@/test/fakes/workspace';
import { createRetainingTestQueryClient, queryWrapper } from '@/test/query';

import { useLibraryLifecycle } from './use-library-lifecycle';

const NOTES: ActiveLibraryFolder = { name: 'Notes', path: '/library/notes' };
const active = librarySnapshot({
  activeFolder: NOTES,
  homeDirectory: '/library',
  members: [{ favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: NOTES.path }],
});
const removed = librarySnapshot({ ...active, activeFolder: null, members: [] });

function notesRuntime(client: QueryClient, generation = 1): WorkspaceRuntime {
  return createWorkspaceRuntime(
    workspaceRuntimeOptions({
      folder: NOTES,
      generation,
      queries: createWorkspaceQueryScope(client, NOTES.path),
    }),
  );
}

function lifecycleHarness() {
  let removedHandler: ((folderPath: string) => void) | undefined;
  let prepareHandler: ((folderPath: string) => boolean | Promise<boolean>) | undefined;
  const lifecycle: LibraryLifecyclePort = {
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
  it('keeps a removed-folder scope mounted when its document barrier fails', async () => {
    const queryClient = createRetainingTestQueryClient();
    const api = libraryApi({ load: vi.fn(async () => removed) });
    const native = lifecycleHarness();
    const runtime = notesRuntime(queryClient);
    const beforeRelease = vi.fn(async () => false);
    renderHook(() => useLibraryLifecycle(api, native.lifecycle, runtime, beforeRelease), {
      wrapper: queryWrapper(queryClient),
    });

    await expect(native.prepare(NOTES.path)).resolves.toBe(false);
    act(() => native.remove(NOTES.path));
    await waitFor(() => expect(api.load).toHaveBeenCalledOnce());
    await waitFor(() => expect(beforeRelease).toHaveBeenCalledTimes(2));

    expect(runtime.signal.aborted).toBe(false);
    expect(queryClient.getQueryData(workspaceQueryKeys.library)).toBeUndefined();
  });

  it('retires only a removed folder runtime and evicts its scoped queries', async () => {
    const queryClient = createRetainingTestQueryClient();
    const api = libraryApi({ load: vi.fn(async () => removed) });
    const native = lifecycleHarness();
    const runtime = notesRuntime(queryClient);
    queryClient.setQueryData(workspaceQueryKeys.library, active);
    queryClient.setQueryData(workspaceQueryKeys.files(NOTES.path), { files: [] });
    queryClient.setQueryData(workspaceQueryKeys.files('/library/writing'), { files: [] });
    renderHook(() => useLibraryLifecycle(api, native.lifecycle, runtime), {
      wrapper: queryWrapper(queryClient),
    });

    expect(await native.prepare(NOTES.path)).toBe(true);
    act(() => native.remove(NOTES.path));

    await waitFor(() => expect(runtime.signal.aborted).toBe(true));
    expect(queryClient.getQueryData(workspaceQueryKeys.files(NOTES.path))).toBeUndefined();
    expect(queryClient.getQueryData(workspaceQueryKeys.files('/library/writing'))).toEqual({
      files: [],
    });
    expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual(removed);
  });

  it('rebinds a still-authorized folder after transient 412 context loss', async () => {
    const queryClient = createRetainingTestQueryClient();
    const membership = librarySnapshot({ ...active, activeFolder: null });
    const api = libraryApi({
      load: vi.fn(async () => membership),
      openFolder: vi.fn(async () => active),
    });
    const native = lifecycleHarness();
    const runtime = notesRuntime(queryClient, 4);
    const recovery = renderHook(() => useLibraryLifecycle(api, native.lifecycle, runtime), {
      wrapper: queryWrapper(queryClient),
    });

    act(() => recovery.result.current.recoverLostScope(runtime.scope));

    await waitFor(() => expect(api.openFolder).toHaveBeenCalledOnce());
    expect(api.openFolder).toHaveBeenCalledWith(NOTES.path, expect.any(AbortSignal));
    expect(runtime.signal.aborted).toBe(false);
    expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual(active);
  });

  it('evicts a disposed runtime when authoritative membership omits its folder', () => {
    const queryClient = createRetainingTestQueryClient();
    const api = libraryApi({ load: vi.fn() });
    const native = lifecycleHarness();
    const runtime = notesRuntime(queryClient);
    queryClient.setQueryData(workspaceQueryKeys.library, active);
    queryClient.setQueryData(workspaceQueryKeys.files(NOTES.path), { files: [] });
    const initialProps: { currentRuntime: WorkspaceRuntime | null } = { currentRuntime: runtime };
    const lifecycle = renderHook(
      ({ currentRuntime }: { currentRuntime: WorkspaceRuntime | null }) =>
        useLibraryLifecycle(api, native.lifecycle, currentRuntime),
      { initialProps, wrapper: queryWrapper(queryClient) },
    );

    runtime.dispose();
    queryClient.setQueryData(workspaceQueryKeys.library, removed);
    lifecycle.rerender({ currentRuntime: null });

    expect(queryClient.getQueryData(workspaceQueryKeys.files(NOTES.path))).toBeUndefined();
  });
});

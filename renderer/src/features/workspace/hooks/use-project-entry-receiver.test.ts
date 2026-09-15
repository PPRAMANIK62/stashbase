import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';

import type { ProjectLifecyclePort } from '@/features/workspace/application/ports';
import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import { projectApi, projectLifecycle, projectRegistrySnapshot } from '@/test/fakes/workspace';
import { createRetainingTestQueryClient, queryWrapper } from '@/test/query';

import { useProjectEntryReceiver } from './use-project-entry-receiver';

afterEach(cleanup);

it('acknowledges a committed project only after the workspace mounts', async () => {
  let receive!: Parameters<ProjectLifecyclePort['onEnterFolder']>[0];
  const api = projectApi();
  const lifecycle = projectLifecycle({
    onEnterFolder: (handler) => {
      receive = handler;
      return () => {};
    },
  });
  const cache = createRetainingTestQueryClient();
  const { rerender } = renderHook(
    ({ path }: { path: string | null }) => useProjectEntryReceiver(api, lifecycle, path),
    { initialProps: { path: null as string | null }, wrapper: queryWrapper(cache) },
  );
  let finished = false;
  let result!: Promise<string | null>;
  await act(async () => {
    result = receive('/Library/Research', new AbortController().signal).then((value) => {
      finished = true;
      return value;
    });
  });
  expect(cache.getQueryData(workspaceQueryKeys.project)).toEqual(projectRegistrySnapshot());
  expect(finished).toBe(false);
  rerender({ path: '/Library/Research' });
  await expect(result).resolves.toBeNull();
});

it('rejects a cancelled late open without replacing the previous project cache', async () => {
  let receive!: Parameters<ProjectLifecyclePort['onEnterFolder']>[0];
  let finish!: (snapshot: ReturnType<typeof projectRegistrySnapshot>) => void;
  const api = projectApi({
    openFolder: vi.fn(
      () =>
        new Promise<ReturnType<typeof projectRegistrySnapshot>>((resolve) => {
          finish = resolve;
        }),
    ),
  });
  const lifecycle = projectLifecycle({
    onEnterFolder: (handler) => {
      receive = handler;
      return () => {};
    },
  });
  const cache = createRetainingTestQueryClient();
  const previous = projectRegistrySnapshot({ activeFolder: null });
  cache.setQueryData(workspaceQueryKeys.project, previous);
  renderHook(() => useProjectEntryReceiver(api, lifecycle, null), { wrapper: queryWrapper(cache) });
  const controller = new AbortController();
  const result = receive('/Library/Research', controller.signal);
  controller.abort();
  finish(projectRegistrySnapshot());
  await expect(result).resolves.toContain('interrupted');
  await waitFor(() => expect(cache.getQueryData(workspaceQueryKeys.project)).toEqual(previous));
});

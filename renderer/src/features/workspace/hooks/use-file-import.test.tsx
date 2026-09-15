import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';

import type { UploadPort, UploadResult } from '@/features/workspace/application/ports';
import { createWorkspaceRuntime } from '@/features/workspace/application/runtime';
import { workspaceRuntimeOptions } from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useFileImport } from './use-file-import';

afterEach(cleanup);

it('retains only refused files for retry and ignores completion after project retirement', async () => {
  const client = createTestQueryClient();
  const runtime = createWorkspaceRuntime(workspaceRuntimeOptions());
  let complete!: (value: UploadResult) => void;
  const upload = vi
    .fn<UploadPort['upload']>()
    .mockResolvedValueOnce({ paths: ['a-2.md'], refused: [1] })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
  const hook = renderHook(() => useFileImport(runtime, { upload }), {
    wrapper: queryWrapper(client),
  });
  const files = [new File(['a'], 'a.md'), new File(['b'], 'b.md')];
  await act(() => hook.result.current.importFiles(files));
  expect(hook.result.current.refused).toEqual([files[1]]);
  expect(hook.result.current.imported).toBe(1);
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.importFiles(hook.result.current.refused);
  });
  expect(upload.mock.calls[1]?.[1].map((file) => file.name)).toEqual(['b.md']);
  runtime.dispose();
  expect(upload.mock.calls[1]?.[2].aborted).toBe(true);
  await act(async () => {
    complete({ paths: ['b.md'], refused: [] });
    await pending;
  });
  expect(hook.result.current.imported).toBe(0);
  client.clear();
});

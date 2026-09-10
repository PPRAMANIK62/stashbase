import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspacePreferences } from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useHiddenFiles } from './use-hidden-files';

afterEach(cleanup);

function mount(applied: boolean, port = workspacePreferences(), folderPath: string | null = '/library') {
  return renderHook(() => useHiddenFiles(port, applied, folderPath), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

describe('useHiddenFiles', () => {
  it('reports the visibility the listing was built with, not a value of its own', () => {
    expect(mount(true).result.current.showHiddenFiles).toBe(true);
  });

  it('asks for the opposite of what is applied', async () => {
    const port = workspacePreferences();
    const hook = mount(false, port);

    act(() => hook.result.current.toggle());

    await waitFor(() =>
      expect(port.setShowHiddenFiles).toHaveBeenCalledWith(true, expect.anything()),
    );
  });

  it('ignores a second gesture while a write is open', async () => {
    let release: ((applied: boolean) => void) | undefined;
    const port = workspacePreferences({
      setShowHiddenFiles: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            release = resolve;
          }),
      ),
    });
    const hook = mount(false, port);

    act(() => hook.result.current.toggle());
    await waitFor(() => expect(hook.result.current.pending).toBe(true));
    act(() => hook.result.current.toggle());

    expect(port.setShowHiddenFiles).toHaveBeenCalledTimes(1);
    await act(async () => release?.(true));
  });

  it('leaves the applied visibility alone when the write is refused', async () => {
    const port = workspacePreferences({
      setShowHiddenFiles: vi.fn(async () => {
        throw new Error('refused');
      }),
    });
    const hook = mount(false, port);

    act(() => hook.result.current.toggle());

    await waitFor(() => expect(hook.result.current.pending).toBe(false));
    expect(hook.result.current.showHiddenFiles).toBe(false);
  });

  it('still writes with no folder listed, and asks for no listing refresh', async () => {
    const port = workspacePreferences();
    const hook = mount(false, port, null);

    act(() => hook.result.current.toggle());

    await waitFor(() => expect(port.setShowHiddenFiles).toHaveBeenCalledTimes(1));
  });
});

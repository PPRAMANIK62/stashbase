import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { useBootProgress } from './use-boot-progress';

beforeEach(() => delete document.body.dataset.bootSettled);
afterEach(() => {
  cleanup();
  delete document.body.dataset.bootSettled;
});

describe('useBootProgress', () => {
  it('leaves the boot marker off while the window is still settling', () => {
    renderHook(() => useBootProgress({ memberCount: 0, settled: false }));

    expect(document.body.dataset.bootSettled).toBeUndefined();
  });

  it('marks the boot settled once the window has answered', () => {
    const { rerender } = renderHook(
      ({ settled }: { settled: boolean }) => useBootProgress({ memberCount: 0, settled }),
      { initialProps: { settled: false } },
    );

    rerender({ settled: true });

    expect(document.body.dataset.bootSettled).toBe('1');
  });

  it('holds the Agent back until the library has a folder', () => {
    const { rerender, result } = renderHook(
      ({ memberCount }: { memberCount: number }) => useBootProgress({ memberCount, settled: true }),
      { initialProps: { memberCount: 0 } },
    );
    expect(result.current).toBe(false);

    rerender({ memberCount: 1 });

    expect(result.current).toBe(true);
  });

  it('keeps the Agent started after the last folder is removed', () => {
    const { rerender, result } = renderHook(
      ({ memberCount }: { memberCount: number }) => useBootProgress({ memberCount, settled: true }),
      { initialProps: { memberCount: 2 } },
    );

    rerender({ memberCount: 0 });

    expect(result.current).toBe(true);
  });
});

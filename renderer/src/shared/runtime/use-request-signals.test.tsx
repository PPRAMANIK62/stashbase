import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { useRequestSignals } from './use-request-signals';

afterEach(cleanup);

type Lane = 'install' | 'download';

describe('useRequestSignals', () => {
  it('aborts a lane when that lane starts again', () => {
    const { result } = renderHook(() => useRequestSignals<Lane>());
    const first = result.current('install');
    expect(first.aborted).toBe(false);

    const second = result.current('install');
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });

  it('leaves other lanes running', () => {
    const { result } = renderHook(() => useRequestSignals<Lane>());
    const download = result.current('download');
    result.current('install');
    result.current('install');

    expect(download.aborted).toBe(false);
  });

  it('aborts every open lane on unmount', () => {
    const { result, unmount } = renderHook(() => useRequestSignals<Lane>());
    const install = result.current('install');
    const download = result.current('download');

    unmount();
    expect(install.aborted).toBe(true);
    expect(download.aborted).toBe(true);
  });

  it('hands back one stable opener across re-renders', () => {
    const { result, rerender } = renderHook(() => useRequestSignals<Lane>());
    const opener = result.current;
    rerender();
    expect(result.current).toBe(opener);
  });
});

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';

export const MIN_IMAGE_SCALE = 0.1;
export const MAX_IMAGE_SCALE = 8;

export function clampImageScale(scale: number): number {
  return Math.max(MIN_IMAGE_SCALE, Math.min(MAX_IMAGE_SCALE, scale));
}

function fitScale(
  viewport: HTMLElement | null,
  natural: { height: number; width: number } | null,
): number {
  if (!viewport || !natural) return 1;
  if (viewport.clientWidth <= 48 || viewport.clientHeight <= 48) return 1;
  const dpr = globalThis.devicePixelRatio || 1;
  const width = natural.width / dpr;
  const height = natural.height / dpr;
  return clampImageScale(
    Math.min(1, (viewport.clientWidth - 48) / width, (viewport.clientHeight - 88) / height),
  );
}

export function useImageScale(
  viewportRef: RefObject<HTMLDivElement | null>,
  natural: { height: number; width: number } | null,
  resetKey: string,
) {
  const [mode, setMode] = useState<'actual' | 'fit'>('fit');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setMode('fit');
    setScale(1);
  }, [resetKey]);

  useEffect(() => {
    if (mode !== 'fit' || !natural) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setScale(fitScale(viewport, natural));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [mode, natural, viewportRef]);

  const actual = useCallback(() => {
    setMode('actual');
    setScale(1);
  }, []);
  const fit = useCallback(() => {
    setMode('fit');
    setScale(fitScale(viewportRef.current, natural));
  }, [natural, viewportRef]);
  const setPercentage = useCallback((percentage: number) => {
    setMode('actual');
    setScale((current) => {
      const next = clampImageScale(percentage / 100);
      return Number.isFinite(next) ? next : current;
    });
  }, []);
  const zoomBy = useCallback((factor: number) => {
    setMode('actual');
    setScale((current) => clampImageScale(current * factor));
  }, []);

  return useMemo(
    () => ({ actual, fit, mode, scale, setPercentage, zoomBy }),
    [actual, fit, mode, scale, setPercentage, zoomBy],
  );
}

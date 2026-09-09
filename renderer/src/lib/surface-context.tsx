'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { clamp } from '@/shared/utils/clamp';

const SurfaceContext = createContext<number>(1);

export function useSurface(): number {
  return useContext(SurfaceContext);
}

export function SurfaceProvider({ value, children }: { value: number; children: ReactNode }) {
  const surface = useMemo(() => clamp(value, 1, 8), [value]);
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}

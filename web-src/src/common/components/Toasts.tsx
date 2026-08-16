import { Suspense } from 'react';
import { lazyWithRetry } from '@/common/components/ErrorBoundary';

const ManagedToasts = lazyWithRetry(() => import('@/common/components/ManagedToasts'));

/** Start loading the managed viewport with the shell without adding its Base
 * UI implementation to the initial synchronous chunk. */
export function Toasts() {
  return (
    <Suspense fallback={null}>
      <ManagedToasts />
    </Suspense>
  );
}

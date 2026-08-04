import { Suspense } from 'react';
import { lazyWithRetry } from './ErrorBoundary';

const ManagedToasts = lazyWithRetry(() => import('./ManagedToasts'));

/** Start loading the managed viewport with the shell without adding its Base
 * UI implementation to the initial synchronous chunk. */
export function Toasts() {
  return (
    <Suspense fallback={null}>
      <ManagedToasts />
    </Suspense>
  );
}

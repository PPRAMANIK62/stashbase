import { lazy, Suspense } from 'react';

import type { QuickOpenProps } from './quick-open-types';

const ManagedQuickOpen = lazy(() => import('./managed-quick-open'));

export function QuickOpen(props: QuickOpenProps) {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <ManagedQuickOpen {...props} />
    </Suspense>
  );
}

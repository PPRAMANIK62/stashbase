import { lazy, Suspense } from 'react';

import type { SettingsProps } from './settings-types';

const ManagedSettings = lazy(() => import('./managed-settings'));

export function Settings(props: SettingsProps) {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <ManagedSettings {...props} />
    </Suspense>
  );
}

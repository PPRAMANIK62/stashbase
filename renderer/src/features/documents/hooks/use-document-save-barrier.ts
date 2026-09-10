import { useEffect, useRef } from 'react';

import type { DocumentWindowLifecyclePort } from '@/features/documents/application/ports';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

export function useDocumentSaveBarrier(
  runtime: DocumentTabsRuntime | null,
  lifecycle: DocumentWindowLifecyclePort,
): void {
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  useEffect(
    () => lifecycle.onPrepareContextRelease(() => runtimeRef.current?.flush() ?? true),
    [lifecycle],
  );
}

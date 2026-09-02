import type { DocumentWindowLifecycle } from '@/features/documents/application/ports';
import type { WindowLifecycleBridge } from '@/platform/electron/window-lifecycle';

export function createDocumentWindowLifecycle(
  bridge: WindowLifecycleBridge,
): DocumentWindowLifecycle {
  return {
    onPrepareContextRelease: (handler) => bridge.onPrepareContextRelease(() => handler()),
  };
}

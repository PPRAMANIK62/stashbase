import type { DocumentWindowLifecyclePort } from '@/features/documents/application/ports';
import type { WindowLifecycleBridge } from '@/platform/electron/window-lifecycle';

export function createDocumentWindowLifecycleAdapter(
  bridge: WindowLifecycleBridge,
): DocumentWindowLifecyclePort {
  return {
    onPrepareContextRelease: (handler) => bridge.onPrepareContextRelease(() => handler()),
  };
}

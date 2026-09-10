import type {
  WindowContextReleaseReason,
  WindowLifecycleResponse,
} from '@/protocols/electron/window-lifecycle';

export interface WindowLifecycleBridge {
  onPrepareContextRelease(
    handler: (reason: WindowContextReleaseReason) => boolean | Promise<boolean>,
  ): () => void;
  reload(): Promise<WindowLifecycleResponse>;
}

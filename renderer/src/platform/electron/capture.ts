import type { CaptureImageAvailable } from '@/protocols/electron/capture';

/** The preload capability for clipboard-image offers. Absent in the web build. */
export interface CaptureBridge {
  markCurrentImageHandled(): void;
  markHandled(hash: string): void;
  onImageAvailable(handler: (image: CaptureImageAvailable) => void): () => void;
  refreshWatch(): Promise<boolean>;
  setComposerFocused(focused: boolean): void;
}

export function isCaptureBridge(value: unknown): value is CaptureBridge {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.markCurrentImageHandled === 'function' &&
    typeof candidate.markHandled === 'function' &&
    typeof candidate.onImageAvailable === 'function' &&
    typeof candidate.refreshWatch === 'function' &&
    typeof candidate.setComposerFocused === 'function'
  );
}

/** Refreshes the desktop watch and reports whether it matches `expected`.
 *  Any failure reads as "not applied"; a missing bridge is a no-op success. */
export async function applyCaptureWatch(
  bridge: CaptureBridge | null,
  expected: boolean,
): Promise<boolean> {
  if (!bridge) return true;
  try {
    return (await bridge.refreshWatch()) === expected;
  } catch {
    return false;
  }
}

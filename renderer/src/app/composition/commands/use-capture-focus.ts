import { useEffect } from 'react';

import type { CaptureBridge } from '@/platform/electron/capture';

/** Forwards Agent composer focus to the desktop clipboard watch, so an offer
 *  never races a paste the reader aimed at the composer. */
export function useComposerFocusSignal(bridge: CaptureBridge | null, focused: boolean): void {
  useEffect(() => {
    bridge?.setComposerFocused(focused);
  }, [bridge, focused]);
}

import { useEffect } from 'react';

import { appearanceSurface, type AppearancePort } from '@/features/settings/public';
import {
  applyAppearanceSurface,
  subscribeToAppearanceSurface,
} from '@/shared/runtime/appearance-surface';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

/**
 * Applies the saved appearance to this window, once at startup and thereafter
 * whenever another window saves a change.
 *
 * The subscription is established before the read so a save that lands
 * mid-request wins: the broadcast is newer than the snapshot in flight, and a
 * late read must never repaint the window with the appearance the reader just
 * changed away from.
 *
 * A failed read is deliberately silent. The stylesheet's own system default
 * stays usable while the configuration is absent or briefly unreadable, and
 * Settings is the surface that reports it.
 */
export function useAppearanceSurface(port: AppearancePort): void {
  const signalFor = useRequestSignals<'appearance'>();

  useEffect(() => {
    let broadcast = false;
    const unsubscribe = subscribeToAppearanceSurface((surface) => {
      broadcast = true;
      applyAppearanceSurface(surface);
    });
    void port
      .load(signalFor('appearance'))
      .then((preferences) => {
        if (!broadcast) applyAppearanceSurface(appearanceSurface(preferences));
      })
      // swallowed: Settings is the surface that reports an unreadable configuration.
      .catch(() => undefined);
    return unsubscribe;
  }, [port, signalFor]);
}

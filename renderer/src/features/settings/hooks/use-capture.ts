import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { settingsFailure } from '@/features/settings/application/failure-messages';
import type { CapturePort, CapturePreferences } from '@/features/settings/application/ports';
import { captureQuery, settingsQueryKeys } from '@/features/settings/application/queries';
import { useSettingsCommand } from '@/features/settings/hooks/use-settings-command';
import type { FailureView } from '@/shared/domain/feature-error';

export const CAPTURE_APPLY_WARNING =
  'Saved, but the desktop capture service could not apply the change. Restart StashBase to retry.';

export interface CaptureWatchApplier {
  /** Resolves true when the desktop watch now matches `expected`. */
  (expected: boolean): Promise<boolean>;
}

/** What the General panel renders and can do. The panel never sees a query or
 *  a mutation object, only this. */
export interface CaptureViewModel {
  readonly clipboardImageImport: boolean;
  /** The opt-in cannot be moved right now: still loading, or a write is open. */
  readonly disabled: boolean;
  readonly failure: FailureView | null;
  /** Saved, but the desktop side did not confirm — worth saying, not an error. */
  readonly warning: string | null;
  setClipboardImageImport(next: boolean): void;
}

export function useCapture(port: CapturePort, applyWatch: CaptureWatchApplier): CaptureViewModel {
  const queryClient = useQueryClient();
  const preferences = useQuery(captureQuery(port));
  const [warning, setWarning] = useState<string | null>(null);
  /** What the opt-in showed before the optimistic write, to put back. */
  const held = useRef<CapturePreferences | null>(null);

  const update = useSettingsCommand(
    'update',
    async (next: CapturePreferences, signal) => {
      const saved = await port.update(next, signal);
      return { applied: await applyWatch(saved.clipboardImageImport), saved };
    },
    {
      onStart: async (next) => {
        // A poll already in flight must not land on top of the optimistic value.
        await queryClient.cancelQueries({ queryKey: settingsQueryKeys.capture });
        held.current =
          queryClient.getQueryData<CapturePreferences>(settingsQueryKeys.capture) ?? null;
        queryClient.setQueryData(settingsQueryKeys.capture, next);
        setWarning(null);
      },
      onFailed: () => {
        const previous = held.current;
        if (previous) queryClient.setQueryData(settingsQueryKeys.capture, previous);
        void applyWatch(previous?.clipboardImageImport ?? false);
      },
      onDone: ({ applied, saved }) => {
        queryClient.setQueryData(settingsQueryKeys.capture, saved);
        setWarning(applied ? null : CAPTURE_APPLY_WARNING);
      },
    },
  );

  return {
    clipboardImageImport: preferences.data?.clipboardImageImport ?? false,
    disabled: preferences.isPending || update.busy,
    failure: preferences.isError ? settingsFailure(preferences.error) : update.failure,
    setClipboardImageImport: (next) => update.run({ clipboardImageImport: next }),
    warning,
  };
}

/**
 * The Software updates row in Settings.
 *
 * Settings answers when it is asked, so unlike the notice strip it reads every
 * phase, including the quiet ones that are not worth interrupting anyone for.
 * It volunteers nothing and it dismisses nothing.
 */
import { useCallback } from 'react';

import type { UpdatesPort } from '@/features/updates/application/ports';
import { updateOffer } from '@/features/updates/domain/update-offer';
import { updateInProgress } from '@/features/updates/domain/update-status';
import { useUpdates } from '@/features/updates/hooks/use-updates';
import type { SoftwareUpdateRow } from '@/shared/domain/software-update';

export function useSoftwareUpdate(port: UpdatesPort | null): SoftwareUpdateRow {
  const { failure, run, running, state } = useUpdates(port);

  const check = useCallback(() => {
    run((updater) => updater.check());
  }, [run]);

  const setAutoCheck = useCallback(
    (enabled: boolean) => {
      run((updater) => updater.setAutoCheck(enabled));
    },
    [run],
  );

  return {
    autoCheckEnabled: state.autoCheckEnabled,
    busy: running || updateInProgress(state.status),
    check,
    failure,
    setAutoCheck,
    status: updateOffer(state.status).sentence,
    version: state.currentVersion,
  };
}

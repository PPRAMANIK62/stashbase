import { useState } from 'react';

import { updateOffer } from '@/features/updates/domain/update-offer';
import type { UpdateStatus } from '@/features/updates/domain/update-status';
import type { UpdateNoticeViewModel } from '@/features/updates/hooks/use-update-notice';

const noAction = () => undefined;

/** One window's visual override. It never calls an updater or changes its state. */
export function useUpdatePreview(enabled: boolean) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const stop = () => setStatus(null);
  const offer = enabled && status ? updateOffer(status) : null;
  const notice: UpdateNoticeViewModel | null = offer
    ? {
        act: noAction,
        dismiss: stop,
        failure: null,
        offer: {
          actionLabel: offer.action?.label ?? null,
          message: offer.sentence,
        },
      }
    : null;
  return {
    notice,
    show: (next: UpdateStatus) => {
      if (enabled) setStatus(next);
    },
    stop,
  };
}

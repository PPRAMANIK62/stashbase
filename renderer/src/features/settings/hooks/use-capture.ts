import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { CapturePort, CapturePreferences } from '@/features/settings/application/ports';
import { captureQuery, captureQueryKeys } from '@/features/settings/application/queries';

export const CAPTURE_APPLY_WARNING =
  'Saved, but the desktop capture service could not apply the change. Restart StashBase to retry.';

export interface CaptureWatchApplier {
  /** Resolves true when the desktop watch now matches `expected`. */
  (expected: boolean): Promise<boolean>;
}

export function useCapture(port: CapturePort, applyWatch: CaptureWatchApplier) {
  const queryClient = useQueryClient();
  const preferences = useQuery(captureQuery(port));
  const [warning, setWarning] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: async (next: CapturePreferences) => {
      const saved = await port.update(next, new AbortController().signal);
      const applied = await applyWatch(saved.clipboardImageImport);
      return { applied, saved };
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: captureQueryKeys.all });
      const previous = queryClient.getQueryData<CapturePreferences>(captureQueryKeys.all);
      queryClient.setQueryData(captureQueryKeys.all, next);
      setWarning(null);
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(captureQueryKeys.all, context.previous);
      void applyWatch(context?.previous?.clipboardImageImport ?? false);
    },
    onSuccess: ({ applied, saved }) => {
      queryClient.setQueryData(captureQueryKeys.all, saved);
      setWarning(applied ? null : CAPTURE_APPLY_WARNING);
    },
  });

  return { preferences, update, warning };
}

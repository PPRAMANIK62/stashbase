import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  TranscriptionPort,
  TranscriptionPreferencesPatch,
} from '@/features/settings/application/ports';
import {
  transcriptionQuery,
  transcriptionQueryKeys,
} from '@/features/settings/application/queries';
import { transcriptionBusy } from '@/features/settings/domain/transcription-status';

const DOWNLOAD_POLL_MS = 1_000;

export function useTranscription(port: TranscriptionPort) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    ...transcriptionQuery(port),
    refetchInterval: (query) => {
      const models = query.state.data?.providers.flatMap((provider) => provider.models) ?? [];
      return transcriptionBusy(models) ? DOWNLOAD_POLL_MS : false;
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: transcriptionQueryKeys.all });

  const updatePreferences = useMutation({
    mutationFn: (patch: TranscriptionPreferencesPatch) =>
      port.updatePreferences(patch, new AbortController().signal),
    onSettled: refresh,
  });
  const download = useMutation({
    mutationFn: (id: string) => port.downloadModel(id, new AbortController().signal),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => port.removeModel(id, new AbortController().signal),
    onSettled: refresh,
  });

  return { download, remove, settings, updatePreferences };
}

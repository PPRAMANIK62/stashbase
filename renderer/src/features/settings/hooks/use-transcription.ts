import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { TranscriptionPort } from '@/features/settings/application/ports';
import { transcriptionQuery, settingsQueryKeys } from '@/features/settings/application/queries';
import {
  activeProvider,
  type TranscriptionModel,
  type TranscriptionPreferencesPatch,
  type TranscriptionProvider,
  type TranscriptionSettings,
} from '@/features/settings/domain/transcription';
import { transcriptionBusy } from '@/features/settings/domain/transcription-status';
import {
  anyBusy,
  firstCommandFailure,
  pollWhileBusy,
  useSettingsCommand,
} from '@/features/settings/hooks/use-settings-command';
import type { FailureView } from '@/shared/domain/feature-error';

const DOWNLOAD_POLL_MS = 1_000;

/** What the Transcription panel renders and can do. Choosing an engine also
 *  chooses a model, and that rule lives here rather than in the view. */
export interface TranscriptionViewModel {
  readonly actionFailure: FailureView | null;
  /** A write is open, or the daemon is still downloading or verifying. */
  readonly busy: boolean;
  readonly installedCount: number;
  readonly loading: boolean;
  readonly models: readonly TranscriptionModel[];
  readonly provider: TranscriptionProvider | null;
  readonly settings: TranscriptionSettings | null;
  download(modelId: string): void;
  reload(): void;
  removeModel(modelId: string): void;
  selectLanguage(language: string): void;
  selectModel(modelId: string): void;
  selectProvider(providerId: string): void;
}

export function useTranscription(port: TranscriptionPort): TranscriptionViewModel {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...transcriptionQuery(port),
    refetchInterval: pollWhileBusy(
      (data: TranscriptionSettings) =>
        transcriptionBusy(data.providers.flatMap((provider) => provider.models)),
      DOWNLOAD_POLL_MS,
    ),
  });
  const onSettled = () =>
    void queryClient.invalidateQueries({ queryKey: settingsQueryKeys.transcription });

  const updatePreferences = useSettingsCommand(
    'updatePreferences',
    (patch: TranscriptionPreferencesPatch, signal) => port.updatePreferences(patch, signal),
    { onSettled },
  );
  const download = useSettingsCommand(
    'download',
    (id: string, signal) => port.downloadModel(id, signal),
    { onSettled },
  );
  const remove = useSettingsCommand(
    'remove',
    (id: string, signal) => port.removeModel(id, signal),
    {
      onSettled,
    },
  );

  const settings = query.data ?? null;
  const provider = settings ? activeProvider(settings) : null;
  const models = provider?.models ?? [];
  const busy = anyBusy(updatePreferences, download, remove) || transcriptionBusy(models);

  const selectModel = (modelId: string) => {
    if (!settings || busy || modelId === settings.modelId) return;
    updatePreferences.run({ modelId, providerId: settings.providerId });
  };

  return {
    actionFailure: firstCommandFailure(updatePreferences, download, remove),
    busy,
    download: (modelId) => download.run(modelId),
    installedCount: models.filter((model) => model.available).length,
    loading: query.isPending,
    models,
    provider,
    reload: () => void query.refetch(),
    removeModel: (modelId) => remove.run(modelId),
    selectLanguage: (language) => updatePreferences.run({ language }),
    selectModel,
    // The server requires a model whenever the engine moves, so the panel
    // never has to pick one: prefer an installed model, else the first.
    selectProvider: (providerId) => {
      if (!settings) return;
      const next = settings.providers.find((candidate) => candidate.id === providerId);
      if (!next || next.id === settings.providerId) return;
      const model = next.models.find((candidate) => candidate.available) ?? next.models[0];
      if (!model) return;
      updatePreferences.run({ modelId: model.id, providerId: next.id });
    },
    settings,
  };
}

import { CircleAlert } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  describeTranscriptionModel,
  transcriptionBusy,
} from '@/features/settings/domain/transcription-status';
import type { useTranscription } from '@/features/settings/hooks/use-transcription';
import {
  ChoiceList,
  ChoiceRow,
  ProgressBar,
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
  StatusChip,
} from '@/features/settings/ui/rows';
import type {
  TranscriptionModelWire,
  TranscriptionProviderWire,
} from '@/protocols/http/transcription';

const LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
];

export interface TranscriptionPanelProps {
  transcription: ReturnType<typeof useTranscription>;
}

function ModelRow({
  busy,
  firstTabStop,
  model,
  onDownload,
  onRemove,
  onSelect,
  selected,
}: {
  busy: boolean;
  firstTabStop: boolean;
  model: TranscriptionModelWire;
  onDownload: () => void;
  onRemove: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const display = describeTranscriptionModel(model);
  return (
    <ChoiceRow
      checked={selected}
      detail={display.detail}
      detailTone={display.failed ? 'error' : 'muted'}
      firstTabStop={firstTabStop}
      label={model.label}
      onSelect={onSelect}
      title={
        <>
          {model.label}
          {display.installed && <StatusChip>Installed</StatusChip>}
        </>
      }
      trail={
        <>
          {display.busy && (
            <Button disabled loading size="compact" variant="tertiary">
              Working…
            </Button>
          )}
          {display.action === 'download' && (
            <Button disabled={busy} onClick={onDownload} size="compact" variant="tertiary">
              Download
            </Button>
          )}
          {display.action === 'retry' && (
            <Button disabled={busy} onClick={onDownload} size="compact" variant="tertiary">
              Retry download
            </Button>
          )}
          {display.action === 'remove' && (
            <Button disabled={busy} onClick={onRemove} size="compact" variant="ghost">
              Remove
            </Button>
          )}
        </>
      }
      value={model.id}
    >
      {display.progressPercent !== null && <ProgressBar live value={display.progressPercent} />}
    </ChoiceRow>
  );
}

export function TranscriptionPanel({ transcription }: TranscriptionPanelProps) {
  const providerId = useId();
  const languageId = useId();
  const settings = transcription.settings.data;
  const mutating =
    transcription.updatePreferences.isPending ||
    transcription.download.isPending ||
    transcription.remove.isPending;

  if (transcription.settings.isPending) {
    return (
      <p className="text-caption text-muted-foreground" role="status">
        Loading transcription settings…
      </p>
    );
  }
  if (!settings) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-destructive" role="alert">
          Transcription settings are unavailable.
        </p>
        <Button
          onClick={() => void transcription.settings.refetch()}
          size="compact"
          variant="tertiary"
        >
          Retry
        </Button>
      </div>
    );
  }

  const provider: TranscriptionProviderWire | undefined =
    settings.providers.find((candidate) => candidate.id === settings.providerId) ??
    settings.providers[0];
  const models = provider?.models ?? [];
  const installed = models.filter((model) => model.available).length;
  const busy = mutating || transcriptionBusy(models);
  const actionFailure =
    transcription.updatePreferences.error?.message ??
    transcription.download.error?.message ??
    transcription.remove.error?.message ??
    null;

  const selectProvider = (nextProviderId: string) => {
    const next = settings.providers.find((candidate) => candidate.id === nextProviderId);
    if (!next || next.id === settings.providerId) return;
    const model = next.models.find((candidate) => candidate.available) ?? next.models[0];
    if (!model) return;
    transcription.updatePreferences.mutate({ modelId: model.id, providerId: next.id });
  };

  const selectModel = (modelId: string) => {
    if (busy || modelId === settings.modelId) return;
    transcription.updatePreferences.mutate({ modelId, providerId: settings.providerId });
  };

  return (
    <SettingsPane
      lede="Audio and video become searchable text with the model chosen here. Files wait until a model is installed."
      title="Transcription"
    >
      <SettingsGroup title="Engine">
        <SettingsList>
          <SettingsRow
            detail={provider?.description}
            title={<label htmlFor={providerId}>Provider</label>}
            trail={
              <Select disabled={busy} onValueChange={selectProvider} value={settings.providerId}>
                <SelectTrigger className="min-w-44" id={providerId} size="compact" />
                <SelectContent>
                  {settings.providers.map((candidate, index) => (
                    <SelectItem index={index} key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          {provider?.runtimeError && (
            <SettingsRow
              detail={provider.runtimeError}
              lead={<CircleAlert aria-hidden="true" className="size-4 text-destructive" />}
              role="alert"
              title="Transcription engine unavailable"
              titleTone="error"
            />
          )}
          <SettingsRow
            detail="Auto-detect works for most recordings. Set it when a language is guessed wrong."
            title={<label htmlFor={languageId}>Spoken language</label>}
            trail={
              <Select
                disabled={busy}
                onValueChange={(language) => transcription.updatePreferences.mutate({ language })}
                value={settings.language}
              >
                <SelectTrigger className="min-w-36" id={languageId} size="compact" />
                <SelectContent>
                  {LANGUAGES.map((language, index) => (
                    <SelectItem index={index} key={language.value} value={language.value}>
                      {language.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </SettingsList>
      </SettingsGroup>

      <SettingsGroup
        count={`${installed} of ${models.length} installed`}
        hint="The selected model transcribes new files. Installed models stay on disk until you remove them."
        title="Model"
      >
        <ChoiceList
          aria-label="Transcription model"
          onValueChange={selectModel}
          value={settings.modelId}
        >
          {models.map((model, index) => (
            <ModelRow
              busy={busy}
              firstTabStop={index === 0 && !models.some((m) => m.id === settings.modelId)}
              key={model.id}
              model={model}
              onDownload={() => transcription.download.mutate(model.id)}
              onRemove={() => transcription.remove.mutate(model.id)}
              onSelect={() => selectModel(model.id)}
              selected={model.id === settings.modelId}
            />
          ))}
        </ChoiceList>
      </SettingsGroup>

      {actionFailure && (
        <p className="text-caption text-destructive" role="alert">
          {actionFailure}
        </p>
      )}
    </SettingsPane>
  );
}

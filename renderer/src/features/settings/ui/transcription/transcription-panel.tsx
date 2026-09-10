/**
 * The transcription engine, its spoken language, and the models on disk.
 *
 * A model row's control is read off one discriminated state rather than a set
 * of flags, so "installed" and "download failed" cannot both light up on the
 * same row, and only a running download draws a bar.
 */

import { CircleAlert } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { TranscriptionPort } from '@/features/settings/application/ports';
import type { TranscriptionModel } from '@/features/settings/domain/transcription';
import {
  describeTranscriptionModel,
  type TranscriptionModelDisplay,
} from '@/features/settings/domain/transcription-status';
import { useTranscription } from '@/features/settings/hooks/use-transcription';
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
import { FailureNotice } from '@/shared/ui/failure-notice';

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
  transcriptionApi: TranscriptionPort;
}

/** The one control a model row offers, chosen by its state. */
function modelControl(
  display: TranscriptionModelDisplay,
  busy: boolean,
  onDownload: () => void,
  onRemove: () => void,
): ReactNode {
  switch (display.state) {
    case 'downloading':
    case 'verifying':
      return (
        <Button disabled loading size="compact" variant="tertiary">
          Working…
        </Button>
      );
    case 'missing':
      return (
        <Button disabled={busy} onClick={onDownload} size="compact" variant="tertiary">
          Download
        </Button>
      );
    case 'failed':
      return (
        <Button disabled={busy} onClick={onDownload} size="compact" variant="tertiary">
          Retry download
        </Button>
      );
    case 'installed':
      return (
        <Button disabled={busy} onClick={onRemove} size="compact" variant="ghost">
          Remove
        </Button>
      );
    case 'included':
    case 'unavailable':
      return null;
  }
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
  model: TranscriptionModel;
  onDownload: () => void;
  onRemove: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const display = describeTranscriptionModel(model);
  const onDisk = display.state === 'installed' || display.state === 'included';
  return (
    <ChoiceRow
      checked={selected}
      detail={display.detail}
      detailTone={display.state === 'failed' ? 'error' : 'muted'}
      firstTabStop={firstTabStop}
      label={model.label}
      onSelect={onSelect}
      title={
        <>
          {model.label}
          {onDisk && <StatusChip>Installed</StatusChip>}
        </>
      }
      trail={modelControl(display, busy, onDownload, onRemove)}
      value={model.id}
    >
      {display.state === 'downloading' && <ProgressBar live value={display.progressPercent} />}
    </ChoiceRow>
  );
}

export function TranscriptionPanel({ transcriptionApi }: TranscriptionPanelProps) {
  const transcription = useTranscription(transcriptionApi);
  const providerId = useId();
  const languageId = useId();
  const settings = transcription.settings;
  // The provider rows below map the same list; deriving the trigger's options
  // from it keeps the two in step. Hooks run before the early returns, so this
  // tolerates settings that have not loaded.
  const providerItems = useMemo(
    () => (settings?.providers ?? []).map(({ id, label }) => ({ value: id, label })),
    [settings],
  );

  if (transcription.loading) {
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
        <Button onClick={() => transcription.reload()} size="compact" variant="tertiary">
          Retry
        </Button>
      </div>
    );
  }

  const { busy, models, provider } = transcription;
  const selectedIsListed = models.some((model) => model.id === settings.modelId);

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
              <Select
                disabled={busy}
                items={providerItems}
                onValueChange={transcription.selectProvider}
                size="compact"
                value={settings.providerId}
              >
                <SelectTrigger className="min-w-44" id={providerId} />
                <SelectContent>
                  {settings.providers.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
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
                items={LANGUAGES}
                onValueChange={transcription.selectLanguage}
                size="compact"
                value={settings.language}
              >
                <SelectTrigger className="min-w-36" id={languageId} />
                <SelectContent>
                  {LANGUAGES.map((language) => (
                    <SelectItem key={language.value} value={language.value}>
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
        count={`${transcription.installedCount} of ${models.length} installed`}
        hint="The selected model transcribes new files. Installed models stay on disk until you remove them."
        title="Model"
      >
        <ChoiceList
          aria-label="Transcription model"
          onValueChange={transcription.selectModel}
          value={settings.modelId}
        >
          {models.map((model, index) => (
            <ModelRow
              busy={busy}
              firstTabStop={index === 0 && !selectedIsListed}
              key={model.id}
              model={model}
              onDownload={() => transcription.download(model.id)}
              onRemove={() => transcription.removeModel(model.id)}
              onSelect={() => transcription.selectModel(model.id)}
              selected={model.id === settings.modelId}
            />
          ))}
        </ChoiceList>
      </SettingsGroup>

      {transcription.actionFailure && <FailureNotice failure={transcription.actionFailure} />}
    </SettingsPane>
  );
}

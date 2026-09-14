/**
 * The transcription engine, its spoken language, and the models on disk.
 *
 * A model row's control is read off one discriminated state rather than a set
 * of flags, so "installed" and "download failed" cannot both light up on the
 * same row, and only a running download draws a bar.
 */

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
import { ChoiceList, ChoiceRow } from '@/features/settings/ui/choice-rows';
import {
  ProgressBar,
  SettingsGroup,
  SettingsList,
  SettingsMessage,
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

/** The pane keeps its title and lede while the read is in flight or has
 *  failed, so the section never collapses into a bare sentence. */
const TITLE = 'Transcription';
const LEDE =
  'Turn speech in audio and video into searchable text. Transcription needs an available engine and model.';

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
          {display.state === 'downloading' ? 'Downloading…' : 'Verifying…'}
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

  if (transcription.loading || !settings) {
    return (
      <SettingsPane lede={LEDE} title={TITLE}>
        <SettingsList>
          {transcription.loading ? (
            <SettingsMessage message="Loading transcription settings…" />
          ) : (
            <SettingsMessage
              message="Could not load transcription settings."
              onRetry={() => transcription.reload()}
            />
          )}
        </SettingsList>
      </SettingsPane>
    );
  }

  const { busy, models, provider } = transcription;
  const selectedIsListed = models.some((model) => model.id === settings.modelId);

  return (
    <SettingsPane lede={LEDE} title={TITLE}>
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
              role="status"
              title="Transcription engine unavailable"
              titleTone="muted"
            />
          )}
          <SettingsRow
            detail="Choose a language if automatic detection is incorrect."
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
        hint="Applies to future transcription. Use Reprocess on a file to transcribe it again with these settings."
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

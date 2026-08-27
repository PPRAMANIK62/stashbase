import { type TranscriptionModelId } from '@/common/api/apiTypes';
import { cn } from '@/common/lib/utils';
import { formatMiB } from '@/common/lib/format';
import { useTranscriptionSettings } from '@/features/settings/hooks/useTranscriptionSettings';
import { TRANSCRIPTION_LANGUAGE_OPTIONS } from '@shared/transcription';
import { Button } from '@/common/components/ui/button';
import { Select } from '@/common/components/ui/select';
import { FieldLegend, FieldSet } from '@/common/components/ui/field';
import { Progress, ProgressIndicator, ProgressTrack } from '@/common/components/ui/progress';
import { Section, SectionDescription, SectionHeading } from '@/common/components/ui/section';

export function TranscriptionPanel() {
  const {
    settings,
    error,
    busyModel,
    retry,
    chooseModel,
    chooseLanguage,
    download,
    remove,
  } = useTranscriptionSettings();

  if (!settings && !error) return <div className="py-3 text-base text-muted-foreground">Loading…</div>;
  if (!settings) {
    return (
      <div className="flex flex-col items-start gap-2.5">
        <div className="text-sm text-destructive">Couldn’t load transcription settings: {error}</div>
        <Button variant="outline" size="sm" onClick={retry}>Retry</Button>
      </div>
    );
  }

  const selectedProvider = settings.providers.find((provider) => provider.id === settings.providerId)
    ?? settings.providers[0];

  return (
    <div className="flex flex-col gap-2.5">
      <Section>
        <SectionHeading level={3} className="mb-1">Transcription provider and model</SectionHeading>
        <SectionDescription className="mb-2.5">
          {selectedProvider?.description ?? 'Choose the provider and model used for audio transcription.'}
        </SectionDescription>
        {settings.providers.length > 1 && (
          <Select
            aria-label="Transcription provider"
            className="min-w-45 self-start"
            items={settings.providers.map((provider) => ({ value: provider.id, label: provider.label }))}
            value={selectedProvider?.id ?? ''}
            onValueChange={(id) => {
              const provider = settings.providers.find((candidate) => candidate.id === id);
              const model = provider?.models[0];
              if (provider && model) void chooseModel(provider.id, model.id);
            }}
          />
        )}
        {selectedProvider?.runtimeError && (
          // role="alert": appears (or changes) when a provider probe fails
          // after the panel is already up.
          <div role="alert" className="text-sm text-destructive">Transcription runtime unavailable: {selectedProvider.runtimeError}</div>
        )}
        <FieldSet>
          <FieldLegend className="sr-only">Transcription model</FieldLegend>
          <ul className="m-0 mt-3.5 grid list-none gap-2 p-0">
          {(selectedProvider?.models ?? []).map((model) => {
            const operation = model.operation ?? { status: 'idle' as const };
            const downloading = operation.status === 'downloading';
            const verifying = operation.status === 'verifying';
            const progress = operation.status === 'downloading' && operation.totalBytes > 0
              ? Math.min(100, (operation.receivedBytes / operation.totalBytes) * 100)
              : 0;
            return (
              <li
                key={model.id}
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 rounded-lg border border-border bg-card px-3 py-2.5',
                  settings.providerId === selectedProvider?.id && settings.modelId === model.id && 'border-accent/55',
                )}
              >
                <label className="flex cursor-pointer items-center gap-2.5">
                  {/* Native radio, wearing the UA appearance: there is no
                    * `radio` primitive yet, and a feature may not reach for
                    * `@base-ui/react` itself. The Known Gap is recorded in
                    * `code-review/renderer-styling.md`; the semantics here
                    * are already sound (a FieldSet with a FieldLegend, each
                    * input wrapped by its own label), so what is missing is
                    * the styling, not the accessibility. */}
                  <input
                    type="radio"
                    name="transcription-model"
                    checked={settings.providerId === selectedProvider?.id && settings.modelId === model.id}
                    onChange={() => { if (selectedProvider) void chooseModel(selectedProvider.id, model.id); }}
                  />
                  <span className="grid">
                    <strong>{model.label}</strong>
                    {(model.sizeBytes || model.speed || model.accuracy) && (
                      <small className="text-xs text-muted-foreground">{[model.sizeBytes ? formatMiB(model.sizeBytes) : '', model.speed, model.accuracy].filter(Boolean).join(' · ')}</small>
                    )}
                    {model.resourceUse && <small className="text-xs text-muted-foreground">{model.resourceUse} · multilingual</small>}
                  </span>
                </label>
                <div className="flex min-w-26 items-center justify-end gap-2">
                  {model.management === 'provider' ? (
                    <span className="text-sm text-muted-foreground">{model.available ? 'Available' : 'Unavailable'}</span>
                  ) : downloading ? (
                    <>
                      <Progress
                        aria-label={`Downloading ${model.label}`}
                        value={progress}
                        title={`${progress.toFixed(0)}%`}
                      >
                        <ProgressTrack>
                          <ProgressIndicator />
                        </ProgressTrack>
                      </Progress>
                      <Button variant="outline" size="sm" disabled={busyModel === model.id} onClick={() => { void remove(model.id as TranscriptionModelId, false); }}>
                        Cancel
                      </Button>
                    </>
                  ) : verifying ? (
                    <span className="text-sm text-muted-foreground">Verifying…</span>
                  ) : model.available ? (
                    <Button variant="outline" size="sm" disabled={busyModel === model.id} onClick={() => { void remove(model.id as TranscriptionModelId); }}>
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busyModel === model.id || !!selectedProvider?.runtimeError}
                      title={selectedProvider?.runtimeError ? 'Install or repair the local transcription runtime first.' : undefined}
                      onClick={() => { void download(model.id as TranscriptionModelId); }}
                    >
                      {operation.status === 'failed' ? 'Retry download' : 'Download'}
                    </Button>
                  )}
                </div>
                {operation.status === 'failed' && <div role="alert" className="col-span-full text-sm text-destructive">{operation.error}</div>}
              </li>
            );
          })}
          </ul>
        </FieldSet>
      </Section>

      <Section className="mt-5 border-t border-border pt-4">
        <SectionHeading level={3} className="mb-1">Preferred language</SectionHeading>
        <SectionDescription className="mb-2.5">
          Auto-detect evaluates every long-recording chunk independently. A different language can be chosen for an individual Reprocess attempt.
        </SectionDescription>
        <Select
          aria-label="Preferred language"
          className="min-w-45 self-start"
          items={TRANSCRIPTION_LANGUAGE_OPTIONS}
          value={settings.language}
          onValueChange={(language) => { void chooseLanguage(language); }}
        />
      </Section>
      {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
    </div>
  );
}


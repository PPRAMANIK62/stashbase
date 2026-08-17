import { useCallback, useEffect, useRef, useState } from 'react';
import '@/features/settings/settings.css';
import {
  api,
  errorMessage,
  type TranscriptionModelId,
  type TranscriptionSettings,
} from '@/common/api/api';
import { formatMiB } from '@/common/lib/format';
import { useAppActions } from '@/store/contexts/AppContext';
import { TRANSCRIPTION_LANGUAGE_OPTIONS } from '@/../../shared/transcription.ts';
import { Button } from '@/common/components/ui/button';
import { Select } from '@/common/components/ui/select';

export function TranscriptionPanel() {
  const { actions } = useAppActions();
  const [settings, setSettings] = useState<TranscriptionSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyModel, setBusyModel] = useState<TranscriptionModelId | null>(null);
  const [nonce, setNonce] = useState(0);
  const preferenceGeneration = useRef(0);

  const load = useCallback(async (expectedGeneration = preferenceGeneration.current) => {
    const next = await api.transcriptionSettings();
    if (expectedGeneration !== preferenceGeneration.current) return next;
    setSettings(next);
    setError(null);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      const expectedGeneration = preferenceGeneration.current;
      try {
        const next = await api.transcriptionSettings();
        if (cancelled) return;
        if (expectedGeneration === preferenceGeneration.current) {
          setSettings(next);
          setError(null);
        }
        if (next.providers.some((provider) => provider.models.some((model) => (
          model.operation?.status === 'downloading' || model.operation?.status === 'verifying'
        )))) {
          timer = setTimeout(refresh, 700);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(errorMessage(err));
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [nonce]);

  async function chooseModel(providerId: string, modelId: string) {
    if (!settings || (settings.providerId === providerId && modelId === settings.modelId)) return;
    const generation = ++preferenceGeneration.current;
    setSettings({ ...settings, providerId, modelId });
    try {
      await api.setTranscriptionPreferences({ providerId, modelId });
      if (generation === preferenceGeneration.current) setNonce((value) => value + 1);
    } catch (err: unknown) {
      if (generation !== preferenceGeneration.current) return;
      setError(errorMessage(err));
      void load(generation).catch(() => undefined);
    }
  }

  async function chooseLanguage(language: string) {
    if (!settings) return;
    const generation = ++preferenceGeneration.current;
    const previous = settings.language;
    setSettings({ ...settings, language });
    try {
      await api.setTranscriptionPreferences({ language });
      if (generation === preferenceGeneration.current) setNonce((value) => value + 1);
    } catch (err: unknown) {
      if (generation !== preferenceGeneration.current) return;
      setSettings((current) => current ? { ...current, language: previous } : current);
      setError(errorMessage(err));
    }
  }

  async function download(modelId: TranscriptionModelId) {
    setBusyModel(modelId);
    setError(null);
    try {
      await api.downloadTranscriptionModel(modelId);
      setNonce((value) => value + 1);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusyModel(null);
    }
  }

  async function remove(modelId: TranscriptionModelId, confirmRemoval = true) {
    if (confirmRemoval) {
      const confirmed = await actions.confirm(
        `Remove the downloaded ${modelId} transcription model? Existing transcripts stay available.`,
        { title: 'Remove transcription model?', confirmLabel: 'Remove', destructive: true },
      );
      if (!confirmed) return;
    }
    setBusyModel(modelId);
    setError(null);
    try {
      await api.removeTranscriptionModel(modelId);
      setNonce((value) => value + 1);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusyModel(null);
    }
  }

  if (!settings && !error) return <div className="py-3 text-base text-muted-foreground">Loading…</div>;
  if (!settings) {
    return (
      <div className="flex flex-col items-start gap-2.5">
        <div className="text-sm text-destructive">Couldn’t load transcription settings: {error}</div>
        <Button variant="outline" size="sm" onClick={() => setNonce((value) => value + 1)}>Retry</Button>
      </div>
    );
  }

  const selectedProvider = settings.providers.find((provider) => provider.id === settings.providerId)
    ?? settings.providers[0];

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <div className="mb-1 text-base font-semibold">Transcription provider and model</div>
        <div className="mb-2.5 text-sm leading-normal text-muted-foreground">
          {selectedProvider?.description ?? 'Choose the provider and model used for audio transcription.'}
        </div>
        {settings.providers.length > 1 && (
          <Select
            className="min-w-45 self-start"
            value={selectedProvider?.id ?? ''}
            onChange={(event) => {
              const provider = settings.providers.find((candidate) => candidate.id === event.target.value);
              const model = provider?.models[0];
              if (provider && model) void chooseModel(provider.id, model.id);
            }}
          >
            {settings.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
          </Select>
        )}
        {selectedProvider?.runtimeError && (
          <div className="text-sm text-destructive">Transcription runtime unavailable: {selectedProvider.runtimeError}</div>
        )}
        <div className="transcription-model-list">
          {(selectedProvider?.models ?? []).map((model) => {
            const operation = model.operation ?? { status: 'idle' as const };
            const downloading = operation.status === 'downloading';
            const verifying = operation.status === 'verifying';
            const progress = operation.status === 'downloading' && operation.totalBytes > 0
              ? Math.min(100, (operation.receivedBytes / operation.totalBytes) * 100)
              : 0;
            return (
              <div key={model.id} className={'transcription-model-row' + (settings.providerId === selectedProvider?.id && settings.modelId === model.id ? ' selected' : '')}>
                <label>
                  <input
                    type="radio"
                    name="transcription-model"
                    checked={settings.providerId === selectedProvider?.id && settings.modelId === model.id}
                    onChange={() => { if (selectedProvider) void chooseModel(selectedProvider.id, model.id); }}
                  />
                  <span>
                    <strong>{model.label}</strong>
                    {(model.sizeBytes || model.speed || model.accuracy) && (
                      <small>{[model.sizeBytes ? formatMiB(model.sizeBytes) : '', model.speed, model.accuracy].filter(Boolean).join(' · ')}</small>
                    )}
                    {model.resourceUse && <small>{model.resourceUse} · multilingual</small>}
                  </span>
                </label>
                <div className="transcription-model-action">
                  {model.management === 'provider' ? (
                    <span className="text-sm text-muted-foreground">{model.available ? 'Available' : 'Unavailable'}</span>
                  ) : downloading ? (
                    <>
                      <span className="transcription-download-progress" title={`${progress.toFixed(0)}%`}>
                        <span style={{ width: `${progress}%` }} />
                      </span>
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
                {operation.status === 'failed' && <div className="transcription-model-error text-sm text-destructive">{operation.error}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5.5 border-t border-border pt-4.5">
        <div className="mb-1 text-base font-semibold">Preferred language</div>
        <div className="mb-2.5 text-sm leading-normal text-muted-foreground">
          Auto-detect evaluates every long-recording chunk independently. A different language can be chosen for an individual Reprocess attempt.
        </div>
        <Select
          className="min-w-45 self-start"
          value={settings.language}
          onChange={(event) => { void chooseLanguage(event.target.value); }}
        >
          {TRANSCRIPTION_LANGUAGE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}


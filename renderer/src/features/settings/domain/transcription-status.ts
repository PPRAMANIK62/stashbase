import type { TranscriptionModel } from './transcription';

/**
 * One transcription model row's state, as a single discriminated value rather
 * than a bag of independent flags: a row cannot be both `failed` and
 * `installed`, and only a running download carries a percentage, so the view
 * switches once instead of reconciling six booleans that could disagree.
 */
export type TranscriptionModelDisplay =
  /** Downloaded and on disk: shows the chip and offers removal. */
  | { readonly state: 'installed'; readonly detail: string }
  /** Downloadable but not here yet. */
  | { readonly state: 'missing'; readonly detail: string }
  | { readonly state: 'downloading'; readonly detail: string; readonly progressPercent: number }
  | { readonly state: 'verifying'; readonly detail: string }
  | { readonly state: 'failed'; readonly detail: string }
  /** Comes with the remote service: nothing to install or remove. */
  | { readonly state: 'included'; readonly detail: string }
  /** Listed by the service but not offered on this account. */
  | { readonly state: 'unavailable'; readonly detail: string };

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function traits(model: TranscriptionModel): string {
  return [model.speed, model.accuracy, model.resourceUse].filter(Boolean).join(' · ');
}

function baseDetail(model: TranscriptionModel): string {
  const size = model.sizeBytes === null ? '' : formatBytes(model.sizeBytes);
  return [size, traits(model)].filter(Boolean).join(' · ');
}

function downloadPercent(receivedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((receivedBytes / totalBytes) * 100)));
}

/** One row's copy and control for a transcription model. */
export function describeTranscriptionModel(model: TranscriptionModel): TranscriptionModelDisplay {
  const base = baseDetail(model);
  if (model.management === 'provider') {
    const detail = base || 'Provided by the service';
    return model.available ? { state: 'included', detail } : { state: 'unavailable', detail };
  }
  switch (model.operation.status) {
    case 'downloading': {
      const percent = downloadPercent(model.operation.receivedBytes, model.operation.totalBytes);
      return { state: 'downloading', detail: `Downloading… ${percent}%`, progressPercent: percent };
    }
    case 'verifying':
      return { state: 'verifying', detail: 'Verifying download…' };
    case 'failed':
      return { state: 'failed', detail: `Download failed: ${model.operation.error}` };
    case 'idle':
      return model.available
        ? { state: 'installed', detail: base || 'Installed' }
        : { state: 'missing', detail: base || 'Not installed' };
  }
}

/** True while any model on the active engine is downloading or verifying, so
 *  the panel can poll and hold its controls instead of racing the daemon. */
export function transcriptionBusy(models: readonly TranscriptionModel[]): boolean {
  return models.some(
    (model) => model.operation.status === 'downloading' || model.operation.status === 'verifying',
  );
}

import type { TranscriptionModelWire } from '@/protocols/http/transcription';

export interface TranscriptionModelDisplay {
  readonly action: 'download' | 'remove' | 'retry' | null;
  readonly busy: boolean;
  readonly detail: string;
  readonly failed: boolean;
  /** Installed on this device; the row shows it as a chip, not in `detail`. */
  readonly installed: boolean;
  readonly progressPercent: number | null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function traits(model: TranscriptionModelWire): string {
  return [model.speed, model.accuracy, model.resourceUse].filter(Boolean).join(' · ');
}

/** One row's copy and control for a transcription model. */
export function describeTranscriptionModel(
  model: TranscriptionModelWire,
): TranscriptionModelDisplay {
  const operation = model.operation ?? { status: 'idle' as const };
  const size = model.sizeBytes === undefined ? '' : formatBytes(model.sizeBytes);
  const base = [size, traits(model)].filter(Boolean).join(' · ');
  if (model.management === 'provider') {
    return {
      action: null,
      busy: false,
      detail: base || 'Provided by the service',
      failed: false,
      installed: model.available,
      progressPercent: null,
    };
  }
  switch (operation.status) {
    case 'downloading': {
      const percent =
        operation.totalBytes > 0
          ? Math.max(
              0,
              Math.min(100, Math.round((operation.receivedBytes / operation.totalBytes) * 100)),
            )
          : 0;
      return {
        action: null,
        busy: true,
        detail: `Downloading… ${percent}%`,
        failed: false,
        installed: false,
        progressPercent: percent,
      };
    }
    case 'verifying':
      return {
        action: null,
        busy: true,
        detail: 'Verifying download…',
        failed: false,
        installed: false,
        progressPercent: null,
      };
    case 'failed':
      return {
        action: 'retry',
        busy: false,
        detail: `Download failed: ${operation.error}`,
        failed: true,
        installed: false,
        progressPercent: null,
      };
    case 'idle':
      return model.available
        ? {
            action: 'remove',
            busy: false,
            detail: base || 'Installed',
            failed: false,
            installed: true,
            progressPercent: null,
          }
        : {
            action: 'download',
            busy: false,
            detail: base || 'Not installed',
            failed: false,
            installed: false,
            progressPercent: null,
          };
  }
}

export function transcriptionBusy(models: readonly TranscriptionModelWire[]): boolean {
  return models.some(
    (model) => model.operation?.status === 'downloading' || model.operation?.status === 'verifying',
  );
}

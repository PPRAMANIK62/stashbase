import { describe, expect, it } from 'vite-plus/test';

import { describeTranscriptionModel, formatBytes, transcriptionBusy } from './transcription-status';

const base = {
  available: false,
  id: 'base',
  label: 'Base',
  management: 'local-download' as const,
  sizeBytes: 150 * 1024 * 1024,
  speed: 'Fast',
};

describe('transcription model display', () => {
  it('offers download, remove, or retry by state', () => {
    expect(describeTranscriptionModel(base)).toMatchObject({
      action: 'download',
      detail: '150 MB · Fast',
    });
    expect(describeTranscriptionModel({ ...base, available: true })).toMatchObject({
      action: 'remove',
      detail: '150 MB · Fast',
      installed: true,
    });
    expect(
      describeTranscriptionModel({
        ...base,
        available: true,
        sizeBytes: undefined,
        speed: undefined,
      }).detail,
    ).toBe('Installed');
    expect(
      describeTranscriptionModel({ ...base, operation: { error: 'timeout', status: 'failed' } }),
    ).toMatchObject({ action: 'retry', failed: true });
    expect(
      describeTranscriptionModel({
        ...base,
        operation: { receivedBytes: 25, status: 'downloading', totalBytes: 100 },
      }),
    ).toMatchObject({ busy: true, progressPercent: 25 });
    expect(describeTranscriptionModel({ ...base, management: 'provider' }).action).toBeNull();
  });

  it('reports busy while any download or verification runs', () => {
    expect(transcriptionBusy([base])).toBe(false);
    expect(transcriptionBusy([{ ...base, operation: { status: 'verifying' } }])).toBe(true);
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB');
  });
});

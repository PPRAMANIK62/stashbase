import { describe, expect, it } from 'vite-plus/test';

import { transcriptionModel } from '@/test/fakes/settings';

import { describeTranscriptionModel, formatBytes, transcriptionBusy } from './transcription-status';

const base = transcriptionModel({ sizeBytes: 150 * 1024 * 1024, speed: 'Fast' });

describe('transcription model display', () => {
  it('reports a downloadable model that is not here yet', () => {
    expect(describeTranscriptionModel(base)).toEqual({
      state: 'missing',
      detail: '150 MB · Fast',
    });
  });

  it('reports an installed model, and falls back to a bare word with no traits', () => {
    expect(describeTranscriptionModel({ ...base, available: true })).toEqual({
      state: 'installed',
      detail: '150 MB · Fast',
    });
    expect(describeTranscriptionModel(transcriptionModel({ available: true })).detail).toBe(
      'Installed',
    );
    expect(describeTranscriptionModel(transcriptionModel()).detail).toBe('Not installed');
  });

  it('carries the percentage only while a download is actually running', () => {
    const downloading = describeTranscriptionModel({
      ...base,
      operation: { receivedBytes: 25, status: 'downloading', totalBytes: 100 },
    });
    expect(downloading).toEqual({
      state: 'downloading',
      detail: 'Downloading… 25%',
      progressPercent: 25,
    });
    expect(describeTranscriptionModel({ ...base, operation: { status: 'verifying' } })).toEqual({
      state: 'verifying',
      detail: 'Verifying download…',
    });
  });

  it('reports a total-free download as zero rather than dividing by it', () => {
    expect(
      describeTranscriptionModel({
        ...base,
        operation: { receivedBytes: 5, status: 'downloading', totalBytes: 0 },
      }),
    ).toEqual({ state: 'downloading', detail: 'Downloading… 0%', progressPercent: 0 });
  });

  it('keeps the reason on a failed download', () => {
    expect(
      describeTranscriptionModel({ ...base, operation: { error: 'timeout', status: 'failed' } }),
    ).toEqual({ state: 'failed', detail: 'Download failed: timeout' });
  });

  it('separates a service-provided model from one the service does not offer', () => {
    expect(
      describeTranscriptionModel({ ...base, available: true, management: 'provider' }),
    ).toEqual({ state: 'included', detail: '150 MB · Fast' });
    expect(describeTranscriptionModel(transcriptionModel({ management: 'provider' }))).toEqual({
      state: 'unavailable',
      detail: 'Provided by the service',
    });
  });

  it('reports busy while any download or verification runs', () => {
    expect(transcriptionBusy([base])).toBe(false);
    expect(transcriptionBusy([{ ...base, operation: { status: 'verifying' } }])).toBe(true);
    expect(
      transcriptionBusy([
        { ...base, operation: { receivedBytes: 1, status: 'downloading', totalBytes: 2 } },
      ]),
    ).toBe(true);
  });

  it('formats sizes at the unit a reader would use', () => {
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB');
    expect(formatBytes(150 * 1024 ** 2)).toBe('150 MB');
    expect(formatBytes(10)).toBe('1 KB');
  });
});

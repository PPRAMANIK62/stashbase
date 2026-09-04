import { describe, expect, it } from 'vite-plus/test';

import {
  formatMediaTime,
  mediaKind,
  mediaPreviewStatusCopy,
  mediaTranscriptStatusCopy,
} from './media';

describe('media presentation', () => {
  it('distinguishes video containers and formats compact timestamps', () => {
    expect(mediaKind('recordings/interview.MP3')).toBe('audio');
    expect(mediaKind('recordings/interview.MOV')).toBe('video');
    expect(formatMediaTime(65_900)).toBe('1:05');
    expect(formatMediaTime(3_665_000)).toBe('1:01:05');
  });

  it('describes compatible-preview progress without implementation detail', () => {
    expect(mediaPreviewStatusCopy({ status: 'queued', tasksAhead: 2 })).toBe(
      'Waiting to convert · 2 ahead',
    );
    expect(
      mediaPreviewStatusCopy({
        completedMs: 20,
        percent: 44.6,
        status: 'converting',
        totalMs: 100,
      }),
    ).toBe('Converting audio · 45%');
  });

  it('keeps transcript failure and blocked copy actionable but private', () => {
    expect(mediaTranscriptStatusCopy({ status: 'failed' })).toBe('Transcript preparation failed.');
    expect(
      mediaTranscriptStatusCopy({
        modelId: 'small',
        providerId: 'local',
        reason: 'model-not-installed',
        status: 'blocked',
      }),
    ).toBe('Install the small transcription model in Settings.');
    expect(
      mediaTranscriptStatusCopy({
        progress: { completedUnits: 25, phase: 'extracting', totalUnits: 100 },
        status: 'pending',
      }),
    ).toBe('Transcribing · 25%');
  });
});

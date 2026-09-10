import { describe, expect, it } from 'vite-plus/test';

import {
  formatMediaTime,
  mediaKind,
  mediaPreviewStatusCopy,
  mediaTranscriptStatusCopy,
  mediaTranscriptVtt,
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

  it('projects the transcript as a WebVTT track browsers can parse', () => {
    const vtt = mediaTranscriptVtt({
      durationMs: 4_000,
      language: 'en',
      model: 'whisper',
      segments: [
        { endMs: 2_000, id: 1, startMs: 0, text: 'Hello there' },
        { endMs: 3_661_500, id: 2, startMs: 3_600_000, text: 'Later' },
      ],
    });

    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.000\nHello there');
    expect(vtt).toContain('01:00:00.000 --> 01:01:01.500\nLater');
  });

  it('never lets cue text end its own cue or inject markup', () => {
    const vtt = mediaTranscriptVtt({
      durationMs: 1_000,
      language: 'en',
      model: 'whisper',
      segments: [{ endMs: 1_000, id: 1, startMs: 0, text: 'a --> b\n\n<i>& more</i>' }],
    });

    expect(vtt).toContain('a --&gt; b  &lt;i&gt;&amp; more&lt;/i&gt;');
    expect(vtt.split('\n\n')).toHaveLength(2);
  });

  it('is still a valid, empty track before any speech is recognised', () => {
    expect(mediaTranscriptVtt(null)).toBe('WEBVTT\n\n');
    expect(
      mediaTranscriptVtt({
        durationMs: 0,
        language: 'en',
        model: 'whisper',
        segments: [{ endMs: 0, id: 1, startMs: 0, text: '   ' }],
      }),
    ).toBe('WEBVTT\n\n');
  });
});

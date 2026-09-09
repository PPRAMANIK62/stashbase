/**
 * Recording vocabulary: audio versus video, transcript and preview status
 * copy, timestamp formatting, and the WebVTT projection of a transcript.
 */
import { VIDEO_SOURCE_EXTENSIONS } from '@/contracts/file-formats';

export type MediaKind = 'audio' | 'video';

export interface MediaTranscriptSegment {
  endMs: number;
  id: number;
  startMs: number;
  text: string;
}

export interface MediaTranscript {
  durationMs: number;
  language: string;
  model: string;
  segments: MediaTranscriptSegment[];
}

type MediaTranscriptProgress =
  | { lane: 'heavy' | 'light'; phase: 'queued' | 'yielded'; tasksAhead: number }
  | {
      completedUnits?: number | undefined;
      currentPage?: number | undefined;
      phase: 'extracting';
      totalUnits?: number | undefined;
    }
  | { phase: 'indexing' };

export type MediaTranscriptState =
  | { status: 'ready'; transcript: MediaTranscript }
  | { status: 'pending'; progress?: MediaTranscriptProgress }
  | {
      modelId?: string;
      providerId: string;
      reason:
        | 'model-not-installed'
        | 'model-unavailable'
        | 'model-verifying'
        | 'provider-unavailable'
        | 'runtime-unavailable';
      status: 'blocked';
    }
  | { status: 'cancelled' }
  | { status: 'failed' };

export type MediaPreviewStatus =
  | { status: 'idle' | 'ready' }
  | { status: 'queued'; tasksAhead: number }
  | {
      completedMs: number;
      percent: number;
      status: 'converting';
      totalMs: number;
    };

function extensionOf(path: string): string | null {
  return path.split('.').at(-1)?.toLowerCase() ?? null;
}

export function mediaKind(path: string): MediaKind {
  const extension = extensionOf(path);
  return extension && VIDEO_SOURCE_EXTENSIONS.some((candidate) => candidate === extension)
    ? 'video'
    : 'audio';
}

export function formatMediaTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function mediaPreviewStatusCopy(status: MediaPreviewStatus | undefined): string {
  if (!status || status.status === 'idle') return 'Preparing a compatible preview…';
  if (status.status === 'ready') return 'Compatible preview ready';
  if (status.status === 'queued') {
    return status.tasksAhead > 0
      ? `Waiting to convert · ${status.tasksAhead} ahead`
      : 'Waiting to convert…';
  }
  return 'percent' in status
    ? `Converting audio · ${Math.round(status.percent)}%`
    : 'Preparing a compatible preview…';
}

export function mediaTranscriptStatusCopy(state: MediaTranscriptState): string | null {
  if (state.status === 'ready') return null;
  if (state.status === 'cancelled') return 'Transcript preparation was cancelled.';
  if (state.status === 'failed') return 'Transcript preparation failed.';
  if (state.status === 'blocked') {
    if (state.reason === 'model-verifying') return 'The transcription model is being verified.';
    if (state.reason === 'model-not-installed') {
      return `Install the ${state.modelId ?? 'selected'} transcription model in Settings.`;
    }
    if (state.reason === 'model-unavailable') {
      return `The ${state.modelId ?? 'selected'} transcription model is unavailable.`;
    }
    if (state.reason === 'runtime-unavailable') return 'The transcription runtime is unavailable.';
    return 'The selected transcription provider is unavailable.';
  }
  const progress = state.progress;
  if (!progress) return 'Preparing transcript…';
  if (progress.phase === 'queued') {
    return progress.tasksAhead > 0
      ? `Waiting to transcribe · ${progress.tasksAhead} ahead`
      : 'Waiting to transcribe…';
  }
  if (progress.phase === 'yielded') return 'Transcription will resume after higher-priority work.';
  if (progress.phase === 'indexing') return 'Finishing transcript…';
  if (
    'completedUnits' in progress &&
    progress.completedUnits !== undefined &&
    progress.totalUnits !== undefined &&
    progress.totalUnits > 0
  ) {
    return `Transcribing · ${Math.min(100, Math.round((progress.completedUnits / progress.totalUnits) * 100))}%`;
  }
  return 'Transcribing…';
}

function vttTime(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const remainder = total % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(remainder).padStart(3, '0')}`;
}

/** Cue text is markup to a WebVTT parser, and a blank line or an arrow would
 *  end the cue early, so both are neutralised. */
function vttCueText(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/\r\n?|\n/gu, ' ')
    .trim();
}

/**
 * The transcript as a WebVTT track, so a recording carries real captions
 * rather than a silent player beside a separate list.
 */
export function mediaTranscriptVtt(transcript: MediaTranscript | null): string {
  const cues = (transcript?.segments ?? [])
    .filter((segment) => segment.endMs > segment.startMs && vttCueText(segment.text).length > 0)
    .map(
      (segment) =>
        `${segment.id}\n${vttTime(segment.startMs)} --> ${vttTime(segment.endMs)}\n${vttCueText(segment.text)}`,
    );
  return `WEBVTT\n\n${cues.join('\n\n')}${cues.length > 0 ? '\n' : ''}`;
}

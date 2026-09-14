import type { AudioTranscript } from '../shared/transcription.ts';

/** Shared by publication, synchronous reads, and prepared-text workers.
 * Keep the function self-contained: workers embed its runtime source so the
 * same validator works in both source and single-file packaged builds. */
export function parseAudioTranscript(value: unknown): AudioTranscript {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid audio transcript');
  const transcript = value as Record<string, unknown>;
  if (transcript.schemaVersion !== 1) throw new Error('invalid audio transcript');
  for (const record of [transcript.source, transcript.provider]) {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) throw new Error('invalid audio transcript');
  }
  const source = transcript.source as Record<string, unknown>;
  const provider = transcript.provider as Record<string, unknown>;
  for (const number of [source.durationMs, source.size, source.mtimeMs]) {
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) throw new Error('invalid audio transcript');
  }
  if ((source.durationMs as number) <= 0) throw new Error('invalid audio transcript');
  for (const text of [source.statIdentity, provider.id, provider.version, provider.model, transcript.language, transcript.createdAt]) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('invalid audio transcript');
  }
  if (
    typeof source.contentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(source.contentHash)
    || !Number.isFinite(Date.parse(transcript.createdAt as string)) || !Array.isArray(transcript.segments)
  ) throw new Error('invalid audio transcript');

  let previousStartMs = -1;
  for (let index = 0; index < transcript.segments.length; index++) {
    const segment = transcript.segments[index];
    if (
      typeof segment !== 'object' || segment === null || Array.isArray(segment)
      || segment.id !== index + 1
      || typeof segment.startMs !== 'number' || !Number.isFinite(segment.startMs) || segment.startMs < 0
      || typeof segment.endMs !== 'number' || !Number.isFinite(segment.endMs) || segment.endMs < segment.startMs
      || segment.endMs > (source.durationMs as number) || segment.startMs < previousStartMs
      || typeof segment.text !== 'string' || !segment.text.trim()
    ) throw new Error('invalid audio transcript');
    previousStartMs = segment.startMs;
  }
  return value as AudioTranscript;
}

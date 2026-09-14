import './__tests__/isolated-home.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FfmpegAudioMediaTools } from './audio-media-tools.ts';
import { setTranscriptionPreferences } from './app-config.ts';
import { registerTranscriptionProvider } from './transcription-provider.ts';
import { cancelAllConversions, getScheduledConversion } from './conversion.ts';
import { cancelAudioTranscriptionsUsingModel, cancelAudioPreparation, maybeConvertAudio, prepareAudioPreview, readAudioTranscript } from './audio-transcription.ts';
import { closeStateDb } from './state-db.ts';
import { registerProjectFolderAsync } from './folder.ts';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

for (const outcome of ['resume', 'rediscovered', 'cancel', 'model-removed'] as const) {
  test(`preview handoff preserves attempt ownership: ${outcome}`, { timeout: 10_000 }, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-handoff-'));
    const source = path.join(root, 'meeting.wav');
    fs.writeFileSync(source, 'source');
    if (outcome === 'rediscovered') await registerProjectFolderAsync(root);
    const inferenceStarted = gate();
    const previewStarted = gate();
    const releasePreview = gate();
    let available = true;
    const calls: Array<{ language: string; model: string }> = [];
    t.after(async () => {
      releasePreview.resolve();
      await cancelAllConversions();
      closeStateDb();
      fs.rmSync(root, { recursive: true, force: true });
    });
    t.mock.method(FfmpegAudioMediaTools.prototype, 'probe', async () => ({ durationMs: 720_000 }));
    t.mock.method(FfmpegAudioMediaTools.prototype, 'decodeChunk', async ({ wavPath }: { wavPath: string }) => {
      fs.writeFileSync(wavPath, 'decoded');
    });
    t.mock.method(FfmpegAudioMediaTools.prototype, 'createPreview', async (_source: string, target: string, signal: AbortSignal) => {
      previewStarted.resolve();
      await Promise.race([
        releasePreview.promise,
        new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('preview cancelled')), { once: true })),
      ]);
      fs.writeFileSync(target, 'preview');
    });
    const providerId = `handoff-${outcome}`;
    registerTranscriptionProvider({
      id: providerId, version: '1',
      settings: () => ({ id: providerId, label: 'Test', kind: 'local', description: '', models: [] }),
      resolveSelection: (id) => id === 'original' && !available
        ? { status: 'blocked', reason: 'model-not-installed' }
        : { status: 'ready', model: { id } },
      transcribe: async ({ language, model, signal }) => {
        calls.push({ language, model: model.id });
        if (outcome === 'rediscovered' && calls.length === 1) {
          fs.appendFileSync(source, ' changed');
          throw new Error('source changed');
        }
        if (calls.length === (outcome === 'rediscovered' ? 3 : 2)) {
          inferenceStarted.resolve();
          await new Promise<void>((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('inference interrupted')), { once: true }));
        }
        return { language, segments: [{ startMs: 2_000, endMs: 3_000, text: calls.length === (outcome === 'rediscovered' ? 2 : 1) ? 'first checkpoint' : 'resumed chunk' }] };
      },
    });
    setTranscriptionPreferences({ providerId, modelId: 'original', language: 'en' });
    const original = maybeConvertAudio(source, { language: 'ja', urgency: 'interactive' });
    await inferenceStarted.promise;
    setTranscriptionPreferences({ modelId: 'replacement', language: 'en' });
    // A poll/discovery after Settings changed must still refer to the old job.
    if (outcome === 'rediscovered') assert.notEqual(maybeConvertAudio(source), original);
    else assert.equal(maybeConvertAudio(source), original);
    assert.deepEqual(await cancelAudioTranscriptionsUsingModel(providerId, 'replacement'), []);
    const preview = prepareAudioPreview(source);
    const coalesced = outcome === 'resume' ? prepareAudioPreview(source) : Promise.resolve();
    const previews = Promise.allSettled([preview, coalesced]);
    await previewStarted.promise;
    if (outcome === 'cancel') await cancelAudioPreparation(source);
    if (outcome === 'model-removed') available = false;
    releasePreview.resolve();
    await previews;
    if (outcome === 'resume' || outcome === 'rediscovered') {
      await maybeConvertAudio(source);
      assert.deepEqual(calls, Array.from({ length: outcome === 'rediscovered' ? 4 : 3 }, () => ({ language: 'ja', model: 'original' })));
      const transcript = readAudioTranscript(source);
      assert.equal(transcript?.provider.model, 'original');
      assert.equal(transcript?.language, 'ja');
      assert.deepEqual(transcript?.segments.map(({ text }) => text), ['first checkpoint', 'resumed chunk']);
    } else {
      assert.equal(calls.length, 2);
      assert.equal(getScheduledConversion(source), null);
      assert.equal(readAudioTranscript(source), null);
    }
  });
}

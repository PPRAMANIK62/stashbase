import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { parseAudioTranscript } from './audio-transcript.ts';
import { validatePreparedAudioTranscript } from './prepared-validation.ts';

function fixture() {
  return {
    schemaVersion: 1,
    source: { durationMs: 2000, size: 42, mtimeMs: 1, statIdentity: '1:2:3', contentHash: 'a'.repeat(64) },
    provider: { id: 'test', version: '1', model: 'small' },
    language: 'en', createdAt: '2026-01-01T00:00:00Z',
    segments: [{ id: 1, startMs: 0, endMs: 1000, text: 'speech' }],
  };
}

test('publication and worker reads accept and reject the same transcript schema', async () => {
  const good = fixture();
  assert.equal(parseAudioTranscript(good), good);
  assert.equal((await validatePreparedAudioTranscript(Buffer.from(JSON.stringify(good)))).contentHash, good.source.contentHash);
  const invalid = [
    { ...good, schemaVersion: 2 }, { ...good, createdAt: 'not a date' },
    { ...good, provider: { ...good.provider, model: '' } },
    { ...good, source: { ...good.source, durationMs: 0 } },
    { ...good, source: { ...good.source, contentHash: 'bad' } },
    { ...good, source: { ...good.source, statIdentity: '' } },
    ...[
      { id: 2 }, { startMs: -1 }, { startMs: 1001 }, { endMs: 2001 }, { text: ' ' },
    ].map((segment) => ({ ...good, segments: [{ ...good.segments[0], ...segment }] })),
    { ...good, segments: [{ ...good.segments[0], startMs: 500 }, { ...good.segments[0], id: 2, startMs: 0 }] },
  ];
  for (const value of invalid) {
    assert.throws(() => parseAudioTranscript(value), /invalid audio transcript/);
    await assert.rejects(validatePreparedAudioTranscript(Buffer.from(JSON.stringify(value))), /invalid audio transcript/);
  }
});

test('shared transcript validator also runs inside a bundled worker', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-validator-bundle-'));
  try {
    const outfile = path.join(root, 'validation.mjs');
    await build({ entryPoints: ['server/prepared-validation.ts'], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node20' });
    const bundled = await import(pathToFileURL(outfile).href) as typeof import('./prepared-validation.ts');
    assert.deepEqual(
      await bundled.validatePreparedAudioTranscript(Buffer.from(JSON.stringify(fixture()))),
      await validatePreparedAudioTranscript(Buffer.from(JSON.stringify(fixture()))),
    );
    await assert.rejects(bundled.validatePreparedAudioTranscript(Buffer.from('{"schemaVersion":1}')), /invalid audio transcript/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

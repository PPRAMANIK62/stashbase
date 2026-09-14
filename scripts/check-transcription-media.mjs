import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise the built binaries, not the developer's system FFmpeg. This small
// AVI has a video stream plus PCM audio; inference and fallback need only audio.
const sidecar = path.resolve(process.argv[2]);
const suffix = process.platform === 'win32' ? '.exe' : '';
const source = fileURLToPath(new URL('../native/transcription/fixtures/pcm.avi', import.meta.url));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-media-check-'));
const run = (tool, args) => execFileSync(path.join(sidecar, tool + suffix), args, {
  encoding: 'utf8', timeout: 30_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', source]));
  assert.ok(Number(probe.format.duration) > 0);
  const wav = path.join(scratch, 'chunk.wav');
  run('ffmpeg', ['-v', 'error', '-nostdin', '-i', source, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
  assert.ok(fs.statSync(wav).size > 44, 'AVI must produce inference audio');
  const preview = path.join(scratch, 'preview.webm');
  run('ffmpeg', ['-v', 'error', '-nostdin', '-i', source, '-vn', '-c:a', 'libopus', '-b:a', '96k', preview]);
  const streams = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', preview])).streams;
  assert.equal(streams.length, 1);
  assert.equal(streams[0].codec_name, 'opus');
  console.log('[transcription-media] AVI probe, inference decode, and Opus fallback passed');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

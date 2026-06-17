import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-recording-home-'));
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

function fileSig(file: string): { size: number; mtimeMs: number; sha256: string } {
  const st = fs.statSync(file);
  return {
    size: st.size,
    mtimeMs: st.mtimeMs,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  };
}

test('reserveRecordingPaths does not overwrite an existing note or bundle', async () => {
  const { reserveRecordingPaths } = await import('./routes/recording.ts');
  const taken = new Set([
    'calls/recording-2026-06-17T00-00-00-000Z.md',
    'calls/recording-2026-06-17T00-00-00-000Z_files',
    'calls/recording-2026-06-17T00-00-00-000Z-2_files',
  ]);

  const paths = reserveRecordingPaths(
    'calls',
    (rel) => taken.has(rel),
    '2026-06-17T00-00-00-000Z',
  );

  assert.equal(paths.noteRel, 'calls/recording-2026-06-17T00-00-00-000Z-3.md');
  assert.equal(paths.bundleName, 'recording-2026-06-17T00-00-00-000Z-3_files');
  assert.equal(paths.videoRel, 'calls/recording-2026-06-17T00-00-00-000Z-3_files/recording.webm');
});

test('reserveRecordingPaths rejects internal or excluded destination dirs', async () => {
  const { reserveRecordingPaths } = await import('./routes/recording.ts');

  assert.throws(
    () => reserveRecordingPaths('.stashbase', () => false, '2026-06-17T00-00-00-000Z'),
    /cannot write into \.stashbase/,
  );
  assert.throws(
    () => reserveRecordingPaths('node_modules/capture', () => false, '2026-06-17T00-00-00-000Z'),
    /excluded directory "node_modules"/,
  );
  assert.throws(
    () => reserveRecordingPaths('../capture', () => false, '2026-06-17T00-00-00-000Z'),
    /invalid segment/,
  );
});

test('isRecordingMime only accepts video media types', async () => {
  const { isRecordingMime } = await import('./routes/recording.ts');

  assert.equal(isRecordingMime('video/webm'), true);
  assert.equal(isRecordingMime('video/mp4; codecs=avc1'), true);
  assert.equal(isRecordingMime('image/png'), false);
  assert.equal(isRecordingMime('application/octet-stream'), false);
  assert.equal(isRecordingMime(undefined), false);
});

test('recording write-back is skipped when the placeholder note changed', async () => {
  const { recordingNoteUnchangedForWrite } = await import('./routes/recording.ts');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-recording-writeback-'));
  const note = path.join(root, 'recording.md');
  fs.writeFileSync(note, '# Recording\n\n_Processing..._\n');
  const startedWith = fileSig(note);

  assert.equal(recordingNoteUnchangedForWrite(root, 'recording.md', startedWith), true);

  fs.writeFileSync(note, '# User edit\n');
  fs.utimesSync(note, new Date(startedWith.mtimeMs + 5000), new Date(startedWith.mtimeMs + 5000));

  assert.equal(recordingNoteUnchangedForWrite(root, 'recording.md', startedWith), false);
});

test('recording write-back is skipped when content changes but size and mtime match', async () => {
  const { recordingNoteUnchangedForWrite } = await import('./routes/recording.ts');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-recording-hash-'));
  const note = path.join(root, 'recording.md');
  fs.writeFileSync(note, 'same-size-a\n');
  const startedWith = fileSig(note);

  fs.writeFileSync(note, 'same-size-b\n');
  fs.utimesSync(note, new Date(startedWith.mtimeMs), new Date(startedWith.mtimeMs));

  assert.equal(recordingNoteUnchangedForWrite(root, 'recording.md', startedWith), false);
});

test('recording helpers refuse paths that escape through symlink directories', { skip: process.platform === 'win32' }, async () => {
  const { __writeBytesInSpaceForTest, recordingNoteUnchangedForWrite } = await import('./routes/recording.ts');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-recording-space-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-recording-external-'));
  const outside = path.join(external, 'recording.md');
  fs.writeFileSync(outside, '# outside\n');
  const st = fs.statSync(outside);
  fs.symlinkSync(external, path.join(root, 'linked'), 'dir');

  assert.equal(
    recordingNoteUnchangedForWrite(root, 'linked/recording.md', {
      size: st.size,
      mtimeMs: st.mtimeMs,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(outside)).digest('hex'),
    }),
    false,
  );
  assert.throws(
    () => __writeBytesInSpaceForTest(root, 'linked/new.webm', Buffer.from('video')),
    /escapes space through symlink/,
  );
  assert.equal(fs.existsSync(path.join(external, 'new.webm')), false);
});

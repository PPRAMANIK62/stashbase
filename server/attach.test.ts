import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cleanupStaleAttachments, safeAttachmentName, uniqueAttachmentName } from './routes/attach.ts';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

test('safeAttachmentName strips traversal and directory segments', () => {
  assert.equal(safeAttachmentName('../../secret.txt'), 'secret.txt');
  assert.equal(safeAttachmentName('..\\..\\secret.txt'), 'secret.txt');
  assert.equal(safeAttachmentName('folder/image.png'), 'image.png');
  assert.equal(safeAttachmentName('.env'), 'env');
  assert.equal(safeAttachmentName('bad\n"name\'.md'), 'bad--name-.md');
  assert.equal(safeAttachmentName(''), 'file');
});

test('uniqueAttachmentName avoids same-batch overwrites', () => {
  const used = new Set<string>();

  assert.equal(uniqueAttachmentName('note.md', used), 'note.md');
  assert.equal(uniqueAttachmentName('note.md', used), 'note-2.md');
  assert.equal(uniqueAttachmentName('../../note.md', used), 'note-3.md');
  assert.equal(uniqueAttachmentName('README', used), 'README');
  assert.equal(uniqueAttachmentName('README', used), 'README-2');
});

test('cleanupStaleAttachments removes only expired batch directories', () => {
  const root = tmpDir('attachments');
  const oldDir = path.join(root, 'old');
  const freshDir = path.join(root, 'fresh');
  const looseFile = path.join(root, 'loose.txt');
  fs.mkdirSync(oldDir);
  fs.mkdirSync(freshDir);
  fs.writeFileSync(path.join(oldDir, 'a.txt'), 'old');
  fs.writeFileSync(path.join(freshDir, 'b.txt'), 'fresh');
  fs.writeFileSync(looseFile, 'keep');

  const now = Date.now();
  fs.utimesSync(oldDir, new Date(now - 10_000), new Date(now - 10_000));
  fs.utimesSync(freshDir, new Date(now), new Date(now));

  cleanupStaleAttachments(root, 5_000, now);

  assert.equal(fs.existsSync(oldDir), false);
  assert.equal(fs.existsSync(freshDir), true);
  assert.equal(fs.existsSync(looseFile), true);
});

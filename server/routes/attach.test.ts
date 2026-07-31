import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { attachRoot, transientAttachmentPreviewPath } from './attach.ts';

test('attachment previews reject a transient-tree symlink to an outside file', () => {
  fs.mkdirSync(attachRoot(), { recursive: true, mode: 0o700 });
  const batch = fs.mkdtempSync(path.join(attachRoot(), 'preview-test-'));
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-outside-')), 'secret.png');
  const uploaded = path.join(batch, 'uploaded.png');
  const linked = path.join(batch, 'image.png');
  try {
    fs.writeFileSync(uploaded, 'not an image');
    fs.writeFileSync(outside, 'not an image');
    fs.symlinkSync(outside, linked);

    assert.equal(transientAttachmentPreviewPath(uploaded), fs.realpathSync(uploaded));
    assert.equal(transientAttachmentPreviewPath(linked), null);
  } finally {
    fs.rmSync(batch, { recursive: true, force: true });
    fs.rmSync(path.dirname(outside), { recursive: true, force: true });
  }
});

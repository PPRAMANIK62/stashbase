import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { codexThreadToBlocks } from './codex-history.ts';
import { transcriptToBlocks } from './routes/sessions.ts';

test('restores a transient image attachment from the persisted prompt marker', () => {
  const imagePath = path.join(os.tmpdir(), 'stashbase-attachments', 'batch-1', 'image.png');
  const blocks = codexThreadToBlocks({
    turns: [{
      items: [{
        type: 'userMessage',
        content: [{
          type: 'text',
          text: `check what is written in the image\n\nAttached files:\n- ${imagePath}`,
        }],
      }],
    }],
  });

  assert.deepEqual(blocks, [{
    kind: 'user',
    id: 'c0',
    text: 'check what is written in the image',
    attachments: [{
      path: imagePath,
      name: 'image.png',
      previewUrl: `/api/agent/attachment-preview?path=${encodeURIComponent(imagePath)}`,
    }],
  }]);
});

test('does not expose arbitrary filesystem paths embedded in a prompt', () => {
  const blocks = codexThreadToBlocks({
    turns: [{
      items: [{
        type: 'userMessage',
        content: [{
          type: 'text',
          text: 'keep this\n\nAttached files:\n- /Users/someone/private.png',
        }],
      }],
    }],
  });

  assert.deepEqual(blocks, [{
    kind: 'user',
    id: 'c0',
    text: 'keep this\n\nAttached files:\n- /Users/someone/private.png',
  }]);
});

test('restores the same attachment thumbnail for a Claude SDK transcript', () => {
  const imagePath = path.join(os.tmpdir(), 'stashbase-attachments', 'batch-2', 'image.png');
  const blocks = transcriptToBlocks([{
    type: 'user',
    message: { content: `review the attached image\n\nAttached files:\n- ${imagePath}` },
  }]);

  assert.deepEqual(blocks, [{
    kind: 'user',
    id: 'h0',
    text: 'review the attached image',
    attachments: [{
      path: imagePath,
      name: 'image.png',
      previewUrl: `/api/agent/attachment-preview?path=${encodeURIComponent(imagePath)}`,
    }],
  }]);
});

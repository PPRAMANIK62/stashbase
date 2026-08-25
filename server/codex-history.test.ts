import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { codexThreadToBlocks } from './codex-history.ts';
import { nativeTimesByUuid, transcriptToBlocks } from './routes/sessions.ts';

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

test('restores a non-image document attachment as a name-only card', () => {
  const blocks = codexThreadToBlocks({
    turns: [{
      items: [{
        type: 'userMessage',
        content: [{
          type: 'text',
          text: 'summarise the report\n\nAttached files:\n- /Users/me/notes/report.pdf',
        }],
      }],
    }],
  });

  assert.deepEqual(blocks, [{
    kind: 'user',
    id: 'c0',
    text: 'summarise the report',
    attachments: [{ path: '/Users/me/notes/report.pdf', name: 'report.pdf' }],
  }]);
});

test('restores a derived-file attachment line, dropping its context hint', () => {
  const blocks = codexThreadToBlocks({
    turns: [{
      items: [{
        type: 'userMessage',
        content: [{
          type: 'text',
          text: 'what does it argue?\n\nAttached files:\n- /Users/me/notes/report.pdf (for text context, use mcp__stashbase__read_file with path /Users/me/notes/report.html; it returns the derived text representation for this pdf)',
        }],
      }],
    }],
  });

  assert.deepEqual(blocks, [{
    kind: 'user',
    id: 'c0',
    text: 'what does it argue?',
    attachments: [{ path: '/Users/me/notes/report.pdf', name: 'report.pdf' }],
  }]);
});

test('restores a non-image document card for a Claude SDK transcript', () => {
  const blocks = transcriptToBlocks([{
    type: 'user',
    message: { content: 'review this\n\nAttached files:\n- /Users/me/docs/spec.docx' },
  }]);

  assert.deepEqual(blocks, [{
    kind: 'user',
    id: 'h0',
    text: 'review this',
    attachments: [{ path: '/Users/me/docs/spec.docx', name: 'spec.docx' }],
  }]);
});

test('leaves an unrecognised attachment path in the prose', () => {
  const blocks = codexThreadToBlocks({
    turns: [{
      items: [{
        type: 'userMessage',
        content: [{
          type: 'text',
          text: 'keep this\n\nAttached files:\n- /etc/passwd',
        }],
      }],
    }],
  });

  assert.deepEqual(blocks, [{
    kind: 'user',
    id: 'c0',
    text: 'keep this\n\nAttached files:\n- /etc/passwd',
  }]);
});

test('turn startedAt/completedAt become user/assistant timestamps in ms', () => {
  const blocks = codexThreadToBlocks({
    turns: [{
      startedAt: 1787636210,
      completedAt: 1787636424,
      items: [
        { type: 'userMessage', content: [{ type: 'text', text: 'question' }] },
        { type: 'agentMessage', text: 'answer' },
      ],
    }],
  });

  assert.deepEqual(blocks, [
    { kind: 'user', id: 'c0', text: 'question', at: 1787636210000 },
    { kind: 'assistant', id: 'c1', text: 'answer', at: 1787636424000 },
  ]);
});

test('a turn without recorded times leaves its messages timeless', () => {
  const blocks = codexThreadToBlocks({
    turns: [{
      items: [
        { type: 'userMessage', content: [{ type: 'text', text: 'question' }] },
        { type: 'agentMessage', text: 'answer' },
      ],
    }],
  });

  assert.deepEqual(blocks, [
    { kind: 'user', id: 'c0', text: 'question' },
    { kind: 'assistant', id: 'c1', text: 'answer' },
  ]);
});

test('Claude SDK messages take their time from the native line sharing their uuid', () => {
  const blocks = transcriptToBlocks(
    [
      { type: 'user', uuid: 'u-1', message: { content: 'question' } },
      { type: 'assistant', uuid: 'a-1', message: { content: [{ type: 'text', text: 'answer' }] } },
      { type: 'assistant', uuid: 'a-2', message: { content: [{ type: 'text', text: 'unjoined' }] } },
    ],
    new Map([['u-1', 1787636210000], ['a-1', 1787636424000]]),
  );

  assert.deepEqual(blocks, [
    { kind: 'user', id: 'h0', text: 'question', at: 1787636210000 },
    { kind: 'assistant', id: 'h1', text: 'answer', at: 1787636424000 },
    { kind: 'assistant', id: 'h2', text: 'unjoined' },
  ]);
});

test('nativeTimesByUuid keeps only real, parseable native timestamps', () => {
  const times = nativeTimesByUuid([
    { type: 'user', uuid: 'u-1', timestamp: '2026-05-20T12:58:56.700Z' },
    { type: 'assistant', uuid: 'a-1', timestamp: 'not a date' },
    { type: 'assistant', uuid: 'a-2' },
    { type: 'assistant', timestamp: '2026-05-20T12:59:00.000Z' },
  ]);
  assert.deepEqual([...times.entries()], [['u-1', Date.parse('2026-05-20T12:58:56.700Z')]]);
});

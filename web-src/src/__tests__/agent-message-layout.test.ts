import assert from 'node:assert/strict';
import test from 'node:test';
import { activitySummary, settledReplySections } from '../components/agent/AgentMessages';
import { buildDiff } from '../components/agent/diffModel';
import { flattenFileMentions, segmentFileMentions } from '../components/agent/mentionText';
import { payloadPreview } from '../components/agent/toolPayload';
import type { Block, ToolBlock } from '../components/agent/types';

test('count-free activity summaries use stable plural category labels', () => {
  const tools: ToolBlock[] = [
    {
      kind: 'tool',
      id: 'bash-1',
      name: 'Bash',
      input: {
        actions: [
          { type: 'read', path: '/tmp/file.md' },
          { type: 'listFiles' },
          { type: 'search' },
          { type: 'command' },
        ],
      },
      status: 'done',
    },
    { kind: 'tool', id: 'change-1', name: 'File change', input: {}, status: 'done' },
    { kind: 'tool', id: 'tool-1', name: 'Fetch', input: {}, status: 'done' },
  ];

  assert.equal(
    activitySummary(tools),
    'Read files, listed folders, searched, ran commands, edited files, used tools',
  );
});

test('terminal Agent errors remain outside the collapsed work trace', () => {
  const work: Block = { kind: 'thinking', id: 'thinking-1', text: 'Checking' };
  const error: Block = { kind: 'error', id: 'error-1', text: 'Deterministic failure' };

  assert.deepEqual(settledReplySections([work, error]), {
    workBlocks: [work],
    answerBlocks: [error],
  });
});

test('the final assistant answer keeps the existing settled layout', () => {
  const work: Block = { kind: 'thinking', id: 'thinking-1', text: 'Checking' };
  const answer: Block = { kind: 'assistant', id: 'answer-1', text: 'Done' };

  assert.deepEqual(settledReplySections([work, answer]), {
    workBlocks: [work],
    answerBlocks: [answer],
  });
});

test('file mentions segment into chips while plain file names stay text', () => {
  assert.deepEqual(segmentFileMentions('see @topic/note.md and README.md'), [
    { kind: 'text', text: 'see' },
    { kind: 'text', text: ' ' },
    { kind: 'mention', path: 'topic/note.md', start: 3 },
    { kind: 'text', text: ' and README.md' },
  ]);
});

test('attachment paths chip verbatim at any boundary', () => {
  // A space defeats the bare-path regex, so only the verbatim
  // attachment-path scan can chip this CJK-glued occurrence.
  const path = '/library/my notes/图.png';
  assert.deepEqual(segmentFileMentions(`对比${path}的内容`, [path]), [
    { kind: 'text', text: '对比' },
    { kind: 'mention', path, start: 2 },
    { kind: 'text', text: '的内容' },
  ]);
});

test('flattened mentions read as bare file names for plain-text surfaces', () => {
  assert.equal(flattenFileMentions('open @topic/note.md now'), 'open note.md now');
});

test('edit diffs trim common lines to three rows of context', () => {
  const lines = ['a', 'b', 'c', 'd', 'e'];
  const diff = buildDiff('Edit', {
    file_path: '/library/note.md',
    old_string: [...lines, 'old', 'x'].join('\n'),
    new_string: [...lines, 'new', 'x'].join('\n'),
  });
  assert.deepEqual(diff, {
    file: '/library/note.md',
    rows: [
      { type: 'ctx', text: 'c' },
      { type: 'ctx', text: 'd' },
      { type: 'ctx', text: 'e' },
      { type: 'del', text: 'old' },
      { type: 'add', text: 'new' },
      { type: 'ctx', text: 'x' },
    ],
  });
});

test('payload previews hoist MCP arguments and drop empty scaffolding', () => {
  assert.equal(
    payloadPreview({ server: '', arguments: { path: '/library/note.md', query: 'plan' } }),
    'path: /library/note.md\n\nquery: plan',
  );
});

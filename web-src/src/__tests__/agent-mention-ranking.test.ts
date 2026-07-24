import assert from 'node:assert/strict';
import test from 'node:test';
import { rankMentionSuggestions } from '../components/agent/mentionRanking';

const files = [
  { name: 'docs/archive/agent-panel.md', format: 'md' as const, heading: '', snippet: '' },
  { name: 'docs/agent.md', format: 'md' as const, heading: '', snippet: '' },
  { name: 'agent-notes.md', format: 'md' as const, heading: '', snippet: '' },
  { name: 'notes/agent.md', format: 'md' as const, heading: '', snippet: '' },
  { name: 'readme.md', format: 'md' as const, heading: '', snippet: '' },
];

const folders = [
  { path: 'docs' },
  { path: 'docs/archive' },
];

test('mention ranking prioritizes exact filename and prefix matches', () => {
  assert.deepEqual(
    rankMentionSuggestions(files, folders, 'agent').map((suggestion) => suggestion.path),
    ['docs/agent.md', 'notes/agent.md', 'agent-notes.md', 'docs/archive/agent-panel.md'],
  );
});

test('mention ranking is stable for an empty query and includes folders within its result cap', () => {
  assert.deepEqual(
    rankMentionSuggestions(files, folders, '', 2).map((suggestion) => suggestion.path),
    ['docs', 'docs/archive'],
  );
});

test('mention ranking includes matching folders with their path context', () => {
  assert.deepEqual(
    rankMentionSuggestions(files, folders, 'archive').map((suggestion) => [suggestion.path, suggestion.kind]),
    [['docs/archive', 'folder'], ['docs/archive/agent-panel.md', 'file']],
  );
});

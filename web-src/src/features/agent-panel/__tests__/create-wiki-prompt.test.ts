import assert from 'node:assert/strict';
import test from 'node:test';
import { CREATE_WIKI_VISIBLE_PROMPT, createWikiPrompt } from '@/features/agent-panel/lib/createWikiPrompt';

test('Create Wiki separates the concise visible action from its safe write contract', () => {
  assert.equal(CREATE_WIKI_VISIBLE_PROMPT, 'Create a Wiki for this folder.');
  const prompt = createWikiPrompt();
  assert.match(prompt, /wiki\/index\.md/);
  assert.match(prompt, /relative Markdown links/);
  assert.match(prompt, /Do not modify anything outside wiki\//);
  assert.match(prompt, /do not move, rename, or delete files/);
  assert.match(prompt, /ask for explicit approval/);
  assert.doesNotMatch(prompt, /AI Index|embedding/i);
});

test('Create Wiki preserves an existing directory while keeping source files outside its write scope', () => {
  const prompt = createWikiPrompt();
  assert.match(prompt, /If wiki\/ already exists, inspect it first/);
  assert.match(prompt, /preserve useful or unrelated material/);
  assert.match(prompt, /update only the pages needed/);
});

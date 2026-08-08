import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claudeActiveModelEvent,
  claudeModelCatalogFailureEvent,
  claudePermissionMode,
  claudeSkillCatalogEvent,
  claudeSkillPrompt,
  selectClaudeModel,
} from '../agent.ts';
import { buildStashbasePreamble } from '../agent-preamble.ts';

test('the preamble orients folder sessions to their folder and library sessions to the whole library', () => {
  const folder = buildStashbasePreamble('/Users/me/Projects/Research');
  assert.match(folder, /Current folder: \*\*Research\*\*/);

  const library = buildStashbasePreamble('/Users/me/Documents/StashBase', 'library');
  assert.match(library, /library-wide/);
  assert.match(library, /whole library is in scope/);
  assert.match(library, /search_library/);
  assert.doesNotMatch(library, /Current folder:/);
});

test('Claude adapter preserves supported Shared Agent Contract access modes', () => {
  assert.equal(claudePermissionMode('default'), 'default');
  assert.equal(claudePermissionMode('acceptEdits'), 'acceptEdits');
  assert.equal(claudePermissionMode('plan'), 'plan');
  assert.equal(claudePermissionMode('auto'), 'auto');
});

test('Claude adapter defaults invalid access modes to Ask', () => {
  assert.equal(claudePermissionMode(), 'default');
  assert.equal(claudePermissionMode('bypassPermissions'), 'default');
});

test('Claude model selection recovers visibly when the SDK rejects a discovered model', async () => {
  const calls: Array<string | undefined> = [];
  const result = await selectClaudeModel('native-model', [{ id: 'native-model', label: 'Native model' }], async (model) => {
    calls.push(model);
    throw new Error('model withdrawn');
  }, false);
  assert.deepEqual(calls, ['native-model']);
  assert.match(result.fallback ?? '', /could not be selected/);
});

test('Claude resume preserves the native model and waits for its init event', async () => {
  let called = false;
  const result = await selectClaudeModel('old-tab-model', [{ id: 'old-tab-model', label: 'Old tab model' }], async () => { called = true; }, true);
  assert.equal(called, false);
  assert.equal(result.fallback, undefined);
});

test('Claude init-event model becomes the visible active model, including a runtime alias absent from discovery', () => {
  const event = claudeActiveModelEvent([{ id: 'sonnet', label: 'Sonnet' }], 'claude-sonnet-native');
  assert.equal(event.activeModel, 'claude-sonnet-native');
  assert.deepEqual(event.models.at(-1), { id: 'claude-sonnet-native', label: 'claude-sonnet-native' });
});

test('Claude catalog failure clears an unverifiable fresh selection with a visible fallback', () => {
  const event = claudeModelCatalogFailureEvent('claude-opus-native', false);
  assert.deepEqual(event.models, []);
  assert.match(event.fallback ?? '', /runtime default/);
});

test('Claude catalog failure does not claim a fallback for a resumed native session', () => {
  const event = claudeModelCatalogFailureEvent('stale-tab-model', true);
  assert.deepEqual(event.models, []);
  assert.equal(event.fallback, undefined);
});

test('Claude publishes single-slash skill labels and sends the selected native command', () => {
  const event = claudeSkillCatalogEvent([{ name: 'release-notes', description: 'Prepare release notes', argumentHint: '<version>' }]);
  assert.deepEqual(event, {
    t: 'skills',
    state: 'available',
    skills: [{ id: 'release-notes', label: 'release-notes', description: 'Prepare release notes', argumentHint: '<version>' }],
  });
  assert.equal(claudeSkillPrompt('prepare the release', 'release-notes'), '/release-notes prepare the release');
  assert.deepEqual(claudeSkillCatalogEvent([]), { t: 'skills', state: 'empty', skills: [] });
});

test('folder-trust pre-acceptance merges into ~/.claude.json without clobbering', async () => {
  const { ensureClaudeFolderTrust } = await import('../agent-rules.ts');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-trust-'));
  const file = path.join(dir, 'claude.json');

  // Missing file → created with only the trust entry.
  ensureClaudeFolderTrust('/Users/me/Notes', file);
  let config = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(config.projects['/Users/me/Notes'].hasTrustDialogAccepted, true);

  // Existing config: sibling keys and other projects survive; the target
  // project's other fields survive too.
  fs.writeFileSync(file, JSON.stringify({
    numStartups: 7,
    projects: {
      '/Users/me/Notes': { history: ['x'], hasTrustDialogAccepted: false },
      '/elsewhere': { hasTrustDialogAccepted: false },
    },
  }));
  ensureClaudeFolderTrust('/Users/me/Notes', file);
  config = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(config.numStartups, 7);
  assert.deepEqual(config.projects['/Users/me/Notes'].history, ['x']);
  assert.equal(config.projects['/Users/me/Notes'].hasTrustDialogAccepted, true);
  assert.equal(config.projects['/elsewhere'].hasTrustDialogAccepted, false);

  // Already trusted → no rewrite (mtime-insensitive check via content).
  const before = fs.readFileSync(file, 'utf8');
  ensureClaudeFolderTrust('/Users/me/Notes', file);
  assert.equal(fs.readFileSync(file, 'utf8'), before);

  // Malformed JSON → left untouched, no throw.
  fs.writeFileSync(file, '{not json');
  ensureClaudeFolderTrust('/Users/me/Notes', file);
  assert.equal(fs.readFileSync(file, 'utf8'), '{not json');

  fs.rmSync(dir, { recursive: true, force: true });
});

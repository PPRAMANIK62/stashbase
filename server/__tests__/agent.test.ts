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

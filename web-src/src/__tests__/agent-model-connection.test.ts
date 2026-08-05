import assert from 'node:assert/strict';
import test from 'node:test';
import { agentConnectionUrl } from '../components/agent/connectionUrl.ts';
import { applyModelEvent, modelMenuLabel, modelMenuLocked, modelMenuVisible } from '../components/agent/modelState.ts';

const base = { protocol: 'http:', host: 'localhost:3000', endpoint: '/ws/agent', windowId: 'window-1', effort: 'high', access: 'default', agent: 'codex' };

test('a fresh Agent session forwards its selected native model', () => {
  const url = new URL(agentConnectionUrl({ ...base, model: 'native-model' }));
  assert.equal(url.searchParams.get('model'), 'native-model');
  assert.equal(url.searchParams.get('resume'), null);
});

test('a resumed Agent session never forwards a stale tab model', () => {
  const url = new URL(agentConnectionUrl({ ...base, model: 'old-tab-model', resume: 'historic-session' }));
  assert.equal(url.searchParams.get('model'), null);
  assert.equal(url.searchParams.get('resume'), 'historic-session');
});

test('model control visibility, locking label, active identity, and fallback state are deterministic', () => {
  const models = [{ id: 'native-model', label: 'Native model' }];
  assert.equal(modelMenuVisible(true, models), true);
  assert.equal(modelMenuVisible(false, models), false);
  assert.equal(modelMenuVisible(true, []), false);
  assert.equal(modelMenuLocked(false, false), false);
  assert.equal(modelMenuLocked(true, false), true);
  assert.equal(modelMenuLocked(false, true), true);
  assert.equal(modelMenuLabel(models, undefined, true), 'Session model');

  const active = applyModelEvent({ models: [], model: undefined, notice: null, resumedSession: true }, { models, activeModel: 'native-model' });
  assert.equal(active.model, 'native-model');
  assert.equal(active.notice, null);
  assert.equal(modelMenuLabel(active.models, active.model, active.resumedSession), 'Native model');

  const fallback = applyModelEvent(active, { models, fallback: 'That model could not be selected; using the runtime default.' });
  assert.equal(fallback.model, undefined);
  assert.match(fallback.notice ?? '', /runtime default/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changedEffortSelection,
  effortLabel,
  effortOptions,
} from '../components/agent/effortMenuState';

test('controlled effort selection accepts one changed level only', () => {
  assert.equal(changedEffortSelection(new Set(['medium']), 'high'), 'medium');
  assert.equal(changedEffortSelection(new Set(['high']), 'high'), null);
  assert.equal(changedEffortSelection(new Set(['__default__']), 'high'), undefined);
  assert.equal(changedEffortSelection(new Set(['__default__']), undefined), null);
  assert.equal(changedEffortSelection(new Set(), 'high'), null);
  assert.equal(changedEffortSelection(new Set(['unsupported']), 'high'), null);
  assert.equal(changedEffortSelection(new Set(['xhigh']), 'high', ['low', 'high']), null);
  assert.equal(changedEffortSelection('all', 'high'), null);
});

test('native effort identifiers retain their advertised order and remain selectable', () => {
  const native = ['ultra', 'minimal', 'provider_native-level'];
  assert.deepEqual(effortOptions(native), native);
  assert.equal(changedEffortSelection(new Set(['ultra']), undefined, native), 'ultra');
  assert.equal(effortLabel('ultra'), 'Ultra');
  assert.equal(effortLabel('provider_native-level'), 'Provider Native Level');
});

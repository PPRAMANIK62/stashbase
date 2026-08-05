import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changedEffortSelection,
  effortMenuState,
} from '../components/agent/effortMenuState';

test('an open effort picker keeps its trigger available while the Agent reconnects', () => {
  assert.deepEqual(
    effortMenuState({ open: true, disabled: true, locked: false }),
    { isOpen: true, triggerDisabled: false },
  );
});

test('a locked effort picker closes and disables its trigger', () => {
  assert.deepEqual(
    effortMenuState({ open: true, disabled: false, locked: true }),
    { isOpen: false, triggerDisabled: true },
  );
});

test('a closed effort picker cannot open while the Agent reconnects', () => {
  assert.deepEqual(
    effortMenuState({ open: false, disabled: true, locked: false }),
    { isOpen: false, triggerDisabled: true },
  );
});

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

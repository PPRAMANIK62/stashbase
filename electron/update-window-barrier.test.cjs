'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createUpdateWindowBarrier,
  createWindowLifecycleUpdateBarrier,
} = require('./update-window-barrier.cjs');

function harness(overrides = {}) {
  const windows = [
    { id: 1, ready: true, live: true },
    { id: 2, ready: true, live: true },
    { id: 3, ready: false, live: true },
    { id: 4, ready: true, live: false },
  ];
  const requested = [];
  const approved = [];
  const revoked = [];
  let blocked = 0;
  const barrier = createUpdateWindowBarrier({
    getWindows: () => windows,
    isLiveWindow: (win) => win.live,
    shouldRequestFlush: (win) => win.ready,
    requestFlush: async (win) => {
      requested.push(win.id);
      return true;
    },
    isWindowEnabled: (win) => win.enabled !== false,
    setWindowEnabled: (win, enabled) => { win.enabled = enabled; },
    approveClose: (win) => { approved.push(win.id); },
    revokeCloseApproval: (win) => { revoked.push(win.id); },
    onBlocked: async () => { blocked += 1; },
    ...overrides,
  });
  return { windows, requested, approved, revoked, blocked: () => blocked, barrier };
}

test('update save barrier flushes every ready live window before approving any close', async () => {
  const releases = new Map();
  const setup = harness({
    requestFlush: (win) => new Promise((resolve) => {
      setup.requested.push(win.id);
      releases.set(win.id, resolve);
    }),
  });

  const pending = setup.barrier.prepare();
  await Promise.resolve();
  assert.deepEqual(setup.requested, [1, 2]);
  assert.deepEqual(setup.approved, []);
  releases.get(1)(true);
  await Promise.resolve();
  assert.deepEqual(setup.approved, []);
  releases.get(2)(true);

  assert.equal(await pending, true);
  assert.deepEqual(setup.approved, [1, 2, 3]);
});

test('one failed or rejected save blocks installation and grants no close approval', async () => {
  const setup = harness({
    requestFlush: async (win) => {
      setup.requested.push(win.id);
      if (win.id === 1) return false;
      throw new Error('renderer disappeared');
    },
    onBlocked: async () => {
      throw new Error('dialog unavailable');
    },
  });

  assert.equal(await setup.barrier.prepare(), false);
  assert.deepEqual(setup.requested, [1, 2]);
  assert.deepEqual(setup.approved, []);
});

test('installation failure revokes exactly the closes approved by the update', async () => {
  const setup = harness();
  assert.equal(await setup.barrier.prepare(), true);
  assert.deepEqual(setup.approved, [1, 2, 3]);

  setup.barrier.revoke();
  setup.barrier.revoke();
  assert.deepEqual(setup.revoked, [1, 2, 3]);
});

test('an update before the window boundary exists asks and approves nothing', async () => {
  let blocked = 0;
  const barrier = createWindowLifecycleUpdateBarrier({
    lifecycle: () => null,
    getWindows: () => [{ id: 1, isEnabled: () => true, setEnabled() {} }],
    isLiveWindow: () => true,
    onBlocked: () => { blocked += 1; },
  });

  assert.equal(await barrier.prepare(), true);
  barrier.revoke();
  assert.equal(blocked, 0);
});

test('locks input before saving and throughout delayed native installation, then restores on failure', async () => {
  const setup = harness({
    requestFlush: async (win) => {
      assert.equal(win.enabled, false);
      win.dirty = false;
      return true;
    },
  });
  setup.windows[1].enabled = false; // Preserve another owner's disabled window.
  setup.windows[0].dirty = true;
  assert.equal(await setup.barrier.prepare(), true);
  assert.equal(setup.barrier.isActive(), true);
  // Native update installation may wait asynchronously after the save replies.
  await Promise.resolve();
  for (const win of setup.windows.filter((win) => win.live)) {
    if (win.enabled) win.dirty = true;
    assert.notEqual(win.dirty, true);
  }
  setup.barrier.revoke();
  assert.equal(setup.barrier.isActive(), false);
  assert.equal(setup.windows[0].enabled, true);
  assert.equal(setup.windows[1].enabled, false);
  assert.equal(setup.windows[2].enabled, true);
});

test('a refused save unlocks every window before presenting recovery', async () => {
  let recoveryState;
  const setup = harness({
    requestFlush: async () => false,
    onBlocked: () => {
      recoveryState = {
        active: setup.barrier.isActive(),
        enabled: setup.windows.filter((win) => win.live).map((win) => win.enabled),
      };
    },
  });
  assert.equal(await setup.barrier.prepare(), false);
  assert.equal(setup.barrier.isActive(), false);
  assert.deepEqual(recoveryState, { active: false, enabled: [true, true, true] });
});


test('late save replies from a revoked install cannot approve a newer attempt', async () => {
  const replies = [];
  const setup = harness({
    requestFlush: () => new Promise((resolve) => { replies.push(resolve); }),
  });
  const first = setup.barrier.prepare();
  setup.barrier.revoke();
  const second = setup.barrier.prepare();
  replies[0](true);
  replies[1](true);
  assert.equal(await first, false);
  assert.deepEqual(setup.approved, []);
  replies[2](true);
  replies[3](true);
  assert.equal(await second, true);
  assert.deepEqual(setup.approved, [1, 2, 3]);
  setup.barrier.revoke();
});

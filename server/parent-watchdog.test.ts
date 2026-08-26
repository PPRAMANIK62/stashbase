import assert from 'node:assert/strict';
import test from 'node:test';
import { startParentWatchdog } from './parent-watchdog.ts';

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('fires onOrphaned once after the parent pid changes', async () => {
  let ppid = 4242;
  let fired = 0;
  const stop = startParentWatchdog({
    onOrphaned: () => { fired += 1; },
    intervalMs: 5,
    platform: 'darwin',
    getPpid: () => ppid,
  });
  await tick(25);
  assert.equal(fired, 0);
  ppid = 1; // reparented → owner is gone
  await tick(50);
  assert.equal(fired, 1);
  stop();
});

test('stays quiet while the parent pid is stable', async () => {
  let fired = 0;
  const stop = startParentWatchdog({
    onOrphaned: () => { fired += 1; },
    intervalMs: 5,
    platform: 'linux',
    getPpid: () => 4242,
  });
  await tick(40);
  stop();
  assert.equal(fired, 0);
});

test('stop() prevents a later orphan check from firing', async () => {
  let ppid = 4242;
  let fired = 0;
  const stop = startParentWatchdog({
    onOrphaned: () => { fired += 1; },
    intervalMs: 5,
    platform: 'darwin',
    getPpid: () => ppid,
  });
  stop();
  ppid = 1;
  await tick(30);
  assert.equal(fired, 0);
});

test('never starts on Windows', async () => {
  let polled = 0;
  const stop = startParentWatchdog({
    onOrphaned: () => { throw new Error('must not fire'); },
    intervalMs: 5,
    platform: 'win32',
    getPpid: () => { polled += 1; return 1; },
  });
  await tick(25);
  stop();
  assert.equal(polled, 0);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { reclaimStaleServerPort, type PortHolderProcess } from './stale-lock.ts';

const ENTRY = '/Applications/StashBase.app/Contents/Resources/app.asar/dist/server/index.mjs';

function harness(processes: Record<number, PortHolderProcess>) {
  const killed: number[] = [];
  return {
    killed,
    deps: {
      platform: 'darwin' as const,
      selfPid: 100,
      listListenerPids: () => Object.keys(processes).map(Number),
      readProcess: (pid: number) => processes[pid] ?? null,
      kill: (pid: number) => { killed.push(pid); },
    },
  };
}

test('kills an orphaned sibling server holding the port', () => {
  const { killed, deps } = harness({
    321: { ppid: 1, command: `/Applications/StashBase.app/Contents/MacOS/StashBase ${ENTRY}` },
  });
  assert.equal(reclaimStaleServerPort(8090, ENTRY, deps), 1);
  assert.deepEqual(killed, [321]);
});

test('spares a sibling whose parent is still alive', () => {
  const { killed, deps } = harness({
    321: { ppid: 555, command: `/Applications/StashBase.app/Contents/MacOS/StashBase ${ENTRY}` },
  });
  assert.equal(reclaimStaleServerPort(8090, ENTRY, deps), 0);
  assert.deepEqual(killed, []);
});

test('spares a foreign process on the port', () => {
  const { killed, deps } = harness({
    321: { ppid: 1, command: '/usr/local/bin/nginx -g daemon off;' },
  });
  assert.equal(reclaimStaleServerPort(8090, ENTRY, deps), 0);
  assert.deepEqual(killed, []);
});

test('never targets itself and skips unreadable processes', () => {
  const { killed, deps } = harness({
    100: { ppid: 1, command: `stashbase ${ENTRY}` },
  });
  // 999 is listed as a listener but has no readable process entry.
  deps.listListenerPids = () => [100, 999];
  assert.equal(reclaimStaleServerPort(8090, ENTRY, deps), 0);
  assert.deepEqual(killed, []);
});

test('reclaims a dev-mode orphan by its tsx entry path', () => {
  const devEntry = '/Users/dev/stashbase/server/index.ts';
  const { killed, deps } = harness({
    77: { ppid: 1, command: `node --import tsx/loader ${devEntry}` },
  });
  assert.equal(reclaimStaleServerPort(8090, devEntry, deps), 1);
  assert.deepEqual(killed, [77]);
});

test('is a no-op on Windows', () => {
  const { killed, deps } = harness({
    321: { ppid: 1, command: `stashbase ${ENTRY}` },
  });
  assert.equal(reclaimStaleServerPort(8090, ENTRY, { ...deps, platform: 'win32' }), 0);
  assert.deepEqual(killed, []);
});

test('a kill failure counts as already gone', () => {
  const { deps } = harness({
    321: { ppid: 1, command: `stashbase ${ENTRY}` },
    322: { ppid: 1, command: `stashbase ${ENTRY}` },
  });
  const killed: number[] = [];
  deps.kill = (pid: number) => {
    if (pid === 321) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
    killed.push(pid);
  };
  assert.equal(reclaimStaleServerPort(8090, ENTRY, deps), 1);
  assert.deepEqual(killed, [322]);
});

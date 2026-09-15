import { afterEach, describe, expect, it } from 'vite-plus/test';

import { readBridge } from './bridge';

// The preload script installs `window.stashbase`, and `Window` already
// declares its shape (see ./bridge), so the fixtures are assigned to the real
// window rather than handed to `readBridge` as a stand-in Window.
const externalNavigation = {
  open: async () => ({ ok: true as const }),
};
const project = {
  chooseFolder: async () => ({ ok: true as const, folderPath: null }),
  cancelEntry: async () => ({ ok: true as const }),
  onEntryCancelled: () => () => {},
  onEnterFolder: () => () => {},
  notifyFolderRemoved: async () => ({ ok: true as const }),
  onFolderRemoved: () => () => undefined,
  openFolderWindow: async () => ({ action: 'opened' as const, ok: true as const }),
  onPrepareFolderRemoval: () => () => undefined,
  prepareFolderRemoval: async () => ({ ok: true as const, ready: true }),
  setActiveFolder: async () => ({ ok: true as const }),
};
const workspaceSession = {
  read: async () => ({ ok: true as const, session: null }),
  write: async () => ({ ok: true as const }),
};
const windowLifecycle = {
  onPrepareContextRelease: () => () => undefined,
};
const runtime = { serverOrigin: 'http://127.0.0.1:8090' };

afterEach(() => {
  delete window.stashbase;
});

describe('Electron bridge', () => {
  it('returns only the validated project and runtime capabilities', () => {
    window.stashbase = {
      externalNavigation,
      project,
      runtime,
      workspaceSession,
      windowLifecycle,
    };
    expect(readBridge()).toEqual({
      externalNavigation,
      project,
      runtime,
      workspaceSession,
      windowLifecycle,
    });
  });

  it('rejects missing capabilities and renderer-supplied window identity', () => {
    window.stashbase = {};
    expect(() => readBridge()).toThrow(/"message": "Required"/u);

    window.stashbase = { externalNavigation, runtime, workspaceSession, windowLifecycle };
    expect(() => readBridge()).toThrow('The project folder picker is unavailable.');

    window.stashbase = {
      externalNavigation,
      project,
      runtime: { ...runtime, windowId: 'renderer-owned' },
      workspaceSession,
      windowLifecycle,
    };
    expect(() => readBridge()).toThrow(/Unrecognized key\(s\) in object: 'windowId'/u);
  });

  it('passes the updates capability through only when it is complete', () => {
    const updates = {
      check: async () => undefined,
      onSnapshot: () => () => undefined,
      openReleasePage: async () => undefined,
      primaryAction: async () => undefined,
      read: async () => undefined,
      setAutoCheck: async () => undefined,
    };
    window.stashbase = {
      externalNavigation,
      project,
      runtime,
      updates,
      workspaceSession,
      windowLifecycle,
    };
    expect(readBridge().updates).toBe(updates);

    // The renderer does not trust preload's shape, so a half-installed
    // capability is no capability at all rather than one that throws later.
    window.stashbase = {
      externalNavigation,
      project,
      runtime,
      updates: { read: async () => undefined },
      workspaceSession,
      windowLifecycle,
    };
    expect(readBridge().updates).toBeUndefined();
  });
});

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { readBridge } from './bridge';

// The preload script installs `window.stashbase`, and `Window` already
// declares its shape (see ./bridge), so the fixtures are assigned to the real
// window rather than handed to `readBridge` as a stand-in Window.
const externalNavigation = {
  open: async () => ({ ok: true as const }),
};
const library = {
  chooseFolder: async () => ({ ok: true as const, folderPath: null }),
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
  reload: async () => ({ ok: true as const, reloaded: false }),
};
const runtime = { serverOrigin: 'http://127.0.0.1:8090' };

afterEach(() => {
  delete window.stashbase;
});

describe('Electron bridge', () => {
  it('returns only the validated library and runtime capabilities', () => {
    window.stashbase = {
      externalNavigation,
      library,
      runtime,
      workspaceSession,
      windowLifecycle,
    };
    expect(readBridge()).toEqual({
      externalNavigation,
      library,
      runtime,
      workspaceSession,
      windowLifecycle,
    });
  });

  it('rejects missing capabilities and renderer-supplied window identity', () => {
    window.stashbase = {};
    expect(() => readBridge()).toThrow(/"message": "Required"/u);

    window.stashbase = { externalNavigation, runtime, workspaceSession, windowLifecycle };
    expect(() => readBridge()).toThrow('The library folder picker is unavailable.');

    window.stashbase = {
      externalNavigation,
      library,
      runtime: { ...runtime, windowId: 'renderer-owned' },
      workspaceSession,
      windowLifecycle,
    };
    expect(() => readBridge()).toThrow(/Unrecognized key\(s\) in object: 'windowId'/u);
  });

  it('passes the bug-report capability through only when it is complete', () => {
    const bugReport = { open: async () => ({ ok: true as const }) };
    window.stashbase = {
      bugReport,
      externalNavigation,
      library,
      runtime,
      workspaceSession,
      windowLifecycle,
    };
    expect(readBridge().bugReport).toBe(bugReport);

    window.stashbase = {
      bugReport: {},
      externalNavigation,
      library,
      runtime,
      workspaceSession,
      windowLifecycle,
    };
    expect(readBridge().bugReport).toBeUndefined();
  });
});

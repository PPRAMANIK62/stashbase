import { describe, expect, it } from 'vite-plus/test';

import { readBridge } from './bridge';

const chooseFolder = async () => ({ ok: true as const, folderPath: null });
const library = {
  chooseFolder,
  notifyFolderRemoved: async () => ({ ok: true as const }),
  onFolderRemoved: () => () => undefined,
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
const externalNavigation = {
  open: async () => ({ ok: true as const }),
};

describe('Electron bridge', () => {
  it('returns only the validated library and runtime capabilities', () => {
    const bridge = readBridge({
      stashbase: {
        externalNavigation,
        library,
        runtime: { serverOrigin: 'http://127.0.0.1:8090' },
        workspaceSession,
        windowLifecycle,
      },
    } as unknown as Window);
    expect(bridge).toEqual({
      externalNavigation,
      library,
      runtime: { serverOrigin: 'http://127.0.0.1:8090' },
      workspaceSession,
      windowLifecycle,
    });
  });

  it('rejects missing capabilities and renderer-supplied window identity', () => {
    expect(() => readBridge({ stashbase: {} } as Window)).toThrow();
    expect(() =>
      readBridge({
        stashbase: {
          externalNavigation,
          library: { chooseFolder: async () => ({ ok: true, folderPath: null }) },
          runtime: {
            serverOrigin: 'http://127.0.0.1:8090',
            windowId: 'renderer-owned',
          },
          workspaceSession,
          windowLifecycle,
        },
      } as unknown as Window),
    ).toThrow();
  });
});

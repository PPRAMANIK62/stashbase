import { describe, expect, it } from 'vite-plus/test';

import { readBridge } from './bridge';

const chooseFolder = async () => ({ ok: true as const, folderPath: null });

describe('Electron bridge', () => {
  it('returns only the validated library and runtime capabilities', () => {
    const bridge = readBridge({
      stashbase: {
        library: { chooseFolder },
        runtime: { serverOrigin: 'http://127.0.0.1:8090' },
      },
    } as Window);
    expect(bridge).toEqual({
      library: { chooseFolder },
      runtime: { serverOrigin: 'http://127.0.0.1:8090' },
    });
  });

  it('rejects missing capabilities and renderer-supplied window identity', () => {
    expect(() => readBridge({ stashbase: {} } as Window)).toThrow();
    expect(() =>
      readBridge({
        stashbase: {
          library: { chooseFolder: async () => ({ ok: true, folderPath: null }) },
          runtime: {
            serverOrigin: 'http://127.0.0.1:8090',
            windowId: 'renderer-owned',
          },
        },
      } as Window),
    ).toThrow();
  });
});

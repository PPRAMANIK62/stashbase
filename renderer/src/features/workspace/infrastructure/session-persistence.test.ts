import { describe, expect, it, vi } from 'vite-plus/test';

import { createWorkspaceSessionSnapshot } from '@/features/workspace/domain/session';

import { createWorkspaceSessionPersistence } from './session-persistence';

describe('workspace session persistence adapter', () => {
  it('maps the strict preload response into an independent domain snapshot', async () => {
    const wire = {
      ...createWorkspaceSessionSnapshot(),
      folders: [
        {
          activeTabId: null,
          expandedPaths: ['drafts'],
          folderPath: '/library/notes',
          selectedPath: null,
          tabs: [],
        },
      ],
    };
    const adapter = createWorkspaceSessionPersistence({
      read: vi.fn(async () => ({ ok: true, session: wire })),
      write: vi.fn(),
    });

    const loaded = await adapter.load();
    expect(loaded).toEqual(wire);
    expect(loaded).not.toBe(wire);
    expect(loaded?.folders).not.toBe(wire.folders);
  });

  it('persists only protocol-approved state and classifies bridge failures locally', async () => {
    const write = vi.fn(async () => ({ ok: true }));
    const adapter = createWorkspaceSessionPersistence({
      read: vi.fn(async () => ({
        ok: false,
        failure: { kind: 'unavailable', message: 'Not available.' },
      })),
      write,
    });

    await expect(adapter.load()).rejects.toThrow('Not available.');
    const snapshot = createWorkspaceSessionSnapshot();
    await adapter.save(snapshot);
    expect(write).toHaveBeenCalledWith(snapshot);
    await expect(
      adapter.save({ ...snapshot, shell: { ...snapshot.shell, sidebarWidth: 500 } }),
    ).rejects.toThrow();
  });
});

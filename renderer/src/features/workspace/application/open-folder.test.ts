import { describe, expect, it, vi } from 'vite-plus/test';

import type { ProjectRegistrySnapshot } from '@/features/workspace/domain/project';
import { projectApi, projectRegistrySnapshot } from '@/test/fakes/workspace';

import { projectFailureMessage } from './failure-messages';
import { openFolder } from './open-folder';
import { ProjectError } from './ports';

const snapshot = projectRegistrySnapshot({
  activeFolder: { name: 'Notes', path: '/project/notes' },
  homeDirectory: '/project',
  projects: [],
});

describe('open project folder', () => {
  it('returns the authoritative snapshot', async () => {
    const api = projectApi({ openFolder: vi.fn(async () => snapshot) });

    await expect(openFolder(api, '/project/notes', new AbortController().signal)).resolves.toEqual({
      status: 'opened',
      snapshot,
    });
  });

  it('keeps a classified failure local to the operation', async () => {
    const api = projectApi({
      openFolder: vi.fn(async () => {
        throw new ProjectError('unavailable', 'HTTP 503 from /api/project');
      }),
    });

    await expect(openFolder(api, '/project/notes', new AbortController().signal)).resolves.toEqual({
      status: 'failed',
      message: projectFailureMessage('unavailable', 'opened'),
    });
  });

  it('rejects a completion that arrives after its operation was cancelled', async () => {
    let resolveOpen: ((value: ProjectRegistrySnapshot) => void) | undefined;
    const controller = new AbortController();
    const api = projectApi({
      openFolder: vi.fn(
        () =>
          new Promise<ProjectRegistrySnapshot>((resolve) => {
            resolveOpen = resolve;
          }),
      ),
    });
    const result = openFolder(api, '/project/notes', controller.signal);

    controller.abort();
    resolveOpen?.(snapshot);

    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });
});

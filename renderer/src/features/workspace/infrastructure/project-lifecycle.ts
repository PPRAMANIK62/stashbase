import { ProjectError, type ProjectLifecyclePort } from '@/features/workspace/application/ports';
import {
  claimedInitialFolder,
  type ProjectLifecycleBridge,
} from '@/platform/electron/project-lifecycle';
import type { ProjectLifecycleResponse } from '@/protocols/electron/project';

function lifecycleFailure(
  response: Extract<ProjectLifecycleResponse, { ok: false }>,
): ProjectError {
  const kind = response.failure.kind;
  return new ProjectError(
    kind === 'invalid-response' || kind === 'unauthorized' ? kind : 'unavailable',
    response.failure.message,
  );
}

function accept(response: ProjectLifecycleResponse): void {
  if (!response.ok) throw lifecycleFailure(response);
}

export function createProjectLifecycleAdapter(
  bridge: ProjectLifecycleBridge,
): ProjectLifecyclePort {
  // The desktop answers the initial folder once and then forgets it, so the
  // answer is held here. Without this, a re-run effect or StrictMode's second
  // mount would ask again and read the null that means "already claimed" as
  // "this window was created for no folder".
  let claimed: Promise<string | null> | null = null;
  return {
    claimInitialFolder() {
      claimed ??= claimedInitialFolder(bridge);
      return claimed;
    },
    async notifyFolderRemoved(folderPath) {
      accept(await bridge.notifyFolderRemoved(folderPath));
    },
    onFolderRemoved: (handler) => bridge.onFolderRemoved(handler),
    onPrepareFolderRemoval: (handler) => bridge.onPrepareFolderRemoval(handler),
    async prepareFolderRemoval(folderPath) {
      const response = await bridge.prepareFolderRemoval(folderPath);
      if (!response.ok) throw lifecycleFailure(response);
      return response.ready;
    },
    async setActiveFolder(folderPath) {
      accept(await bridge.setActiveFolder(folderPath));
    },
  };
}

import { LibraryError, type LibraryLifecycle } from '@/features/workspace/application/ports';
import type { LibraryLifecycleBridge } from '@/platform/electron/library-lifecycle';
import type { LibraryLifecycleResponse } from '@/protocols/electron/library';

function lifecycleFailure(
  response: Extract<LibraryLifecycleResponse, { ok: false }>,
): LibraryError {
  const kind = response.failure.kind;
  return new LibraryError(
    kind === 'invalid-response' || kind === 'unauthorized' ? kind : 'unavailable',
    response.failure.message,
  );
}

function accept(response: LibraryLifecycleResponse): void {
  if (!response.ok) throw lifecycleFailure(response);
}

export function createLibraryLifecycle(bridge: LibraryLifecycleBridge): LibraryLifecycle {
  return {
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

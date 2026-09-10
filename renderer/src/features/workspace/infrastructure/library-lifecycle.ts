import { LibraryError, type LibraryLifecyclePort } from '@/features/workspace/application/ports';
import {
  claimedInitialFolder,
  type LibraryLifecycleBridge,
} from '@/platform/electron/library-lifecycle';
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

export function createLibraryLifecycleAdapter(
  bridge: LibraryLifecycleBridge,
): LibraryLifecyclePort {
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

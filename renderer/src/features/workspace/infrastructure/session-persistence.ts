import type { WorkspaceSessionPersistence } from '@/features/workspace/application/ports';
import type { WorkspaceSessionSnapshot } from '@/features/workspace/domain/session';
import {
  workspaceSessionReadResponseSchema,
  workspaceSessionSnapshotSchema,
  workspaceSessionWriteResponseSchema,
  type WorkspaceSessionSnapshotWire,
} from '@/protocols/electron/workspace-session';

export interface WorkspaceSessionBridge {
  read(): Promise<unknown>;
  write(snapshot: WorkspaceSessionSnapshotWire): Promise<unknown>;
}

function toDomain(snapshot: WorkspaceSessionSnapshotWire): WorkspaceSessionSnapshot {
  return {
    activeFolderPath: snapshot.activeFolderPath,
    folders: snapshot.folders.map((folder) => ({
      activeTabId: folder.activeTabId,
      expandedPaths: [...folder.expandedPaths],
      folderPath: folder.folderPath,
      selectedPath: folder.selectedPath,
      tabs: folder.tabs.map((tab) => ({ ...tab })),
    })),
    shell: { ...snapshot.shell },
    version: snapshot.version,
  };
}

function toWire(snapshot: WorkspaceSessionSnapshot): WorkspaceSessionSnapshotWire {
  return workspaceSessionSnapshotSchema.parse(snapshot);
}

export function createWorkspaceSessionPersistence(
  bridge: WorkspaceSessionBridge,
): WorkspaceSessionPersistence {
  return {
    async load() {
      const response = workspaceSessionReadResponseSchema.parse(await bridge.read());
      if (!response.ok) throw new Error(response.failure.message);
      return response.session ? toDomain(response.session) : null;
    },
    async save(snapshot) {
      const response = workspaceSessionWriteResponseSchema.parse(
        await bridge.write(toWire(snapshot)),
      );
      if (!response.ok) throw new Error(response.failure.message);
    },
  };
}

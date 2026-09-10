import {
  WORKSPACE_SESSION_READ_CHANNEL,
  WORKSPACE_SESSION_WRITE_CHANNEL,
  type WorkspaceSessionReadResponse,
  type WorkspaceSessionSnapshotWire,
  type WorkspaceSessionWriteResponse,
  workspaceSessionReadResponseSchema,
  workspaceSessionSnapshotSchema,
  workspaceSessionWriteResponseSchema,
} from '../../shared/protocols/electron/workspace-session.ts';

export interface WorkspaceSessionIpcRenderer {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
}

export interface WorkspaceSessionPreload {
  read(): Promise<WorkspaceSessionReadResponse>;
  write(snapshot: WorkspaceSessionSnapshotWire): Promise<WorkspaceSessionWriteResponse>;
}

const unavailableRead = (): WorkspaceSessionReadResponse => ({
  ok: false,
  failure: { kind: 'unavailable', message: 'Workspace session state is unavailable.' },
});

const unavailableWrite = (): WorkspaceSessionWriteResponse => ({
  ok: false,
  failure: { kind: 'unavailable', message: 'Workspace session state is unavailable.' },
});

export function createWorkspaceSessionPreload(
  ipcRenderer: WorkspaceSessionIpcRenderer,
): WorkspaceSessionPreload {
  return Object.freeze({
    async read() {
      try {
        const parsed = workspaceSessionReadResponseSchema.safeParse(
          await ipcRenderer.invoke(WORKSPACE_SESSION_READ_CHANNEL),
        );
        return parsed.success ? parsed.data : unavailableRead();
      } catch {
        return unavailableRead();
      }
    },
    async write(snapshot: WorkspaceSessionSnapshotWire) {
      const request = workspaceSessionSnapshotSchema.parse(snapshot);
      try {
        const parsed = workspaceSessionWriteResponseSchema.safeParse(
          await ipcRenderer.invoke(WORKSPACE_SESSION_WRITE_CHANNEL, request),
        );
        return parsed.success ? parsed.data : unavailableWrite();
      } catch {
        return unavailableWrite();
      }
    },
  });
}

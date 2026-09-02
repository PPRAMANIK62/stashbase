import crypto from 'node:crypto';
import path from 'node:path';
import type { BrowserWindow, IpcMain } from 'electron';
import { promises as fs } from 'node:fs';

import {
  WORKSPACE_SESSION_CAPABILITY,
  WORKSPACE_SESSION_READ_CHANNEL,
  WORKSPACE_SESSION_WRITE_CHANNEL,
  type WorkspaceSessionSnapshotWire,
  workspaceSessionFailureSchema,
  workspaceSessionReadResponseSchema,
  workspaceSessionSnapshotSchema,
  workspaceSessionWriteResponseSchema,
} from '../../shared/protocols/electron/workspace-session.ts';
import { authorizeSender, type SenderAuthorization } from '../library/dialog.ts';

export { WORKSPACE_SESSION_CAPABILITY };

export interface WorkspaceSessionStore {
  read(): Promise<WorkspaceSessionSnapshotWire | null>;
  write(snapshot: WorkspaceSessionSnapshotWire): Promise<void>;
}

export interface WorkspaceSessionDependencies extends SenderAuthorization {
  claimRestore(window: BrowserWindow): boolean;
  ipcMain: Pick<IpcMain, 'handle'>;
  store: WorkspaceSessionStore;
}

interface WorkspaceSessionFileSystem {
  mkdir(directory: string, options: { mode: number; recursive: true }): Promise<unknown>;
  readFile(file: string, encoding: 'utf8'): Promise<string>;
  rename(from: string, to: string): Promise<void>;
  rm(file: string, options: { force: true }): Promise<void>;
  writeFile(
    file: string,
    contents: string,
    options: { encoding: 'utf8'; flag: 'wx'; mode: number },
  ): Promise<void>;
}

function fileMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

export function createWorkspaceSessionStore({
  filePath,
  fileSystem = fs,
}: {
  filePath: string;
  fileSystem?: WorkspaceSessionFileSystem;
}): WorkspaceSessionStore {
  let writeQueue = Promise.resolve();

  const write = async (snapshot: WorkspaceSessionSnapshotWire) => {
    const validated = workspaceSessionSnapshotSchema.parse(snapshot);
    await fileSystem.mkdir(path.dirname(filePath), { mode: 0o700, recursive: true });
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
      await fileSystem.writeFile(temporary, `${JSON.stringify(validated)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      try {
        await fileSystem.rename(temporary, filePath);
      } catch (error) {
        if (
          typeof error !== 'object' ||
          error === null ||
          !('code' in error) ||
          (error.code !== 'EEXIST' && error.code !== 'EPERM')
        ) {
          throw error;
        }
        await fileSystem.rm(filePath, { force: true });
        await fileSystem.rename(temporary, filePath);
      }
    } finally {
      await fileSystem.rm(temporary, { force: true });
    }
  };

  return {
    async read() {
      await writeQueue.catch(() => undefined);
      let raw: string;
      try {
        raw = await fileSystem.readFile(filePath, 'utf8');
      } catch (error) {
        if (fileMissing(error)) return null;
        throw error;
      }
      try {
        const parsed = workspaceSessionSnapshotSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    write(snapshot) {
      writeQueue = writeQueue.catch(() => undefined).then(() => write(snapshot));
      return writeQueue;
    },
  };
}

const failure = (kind: 'unauthorized' | 'unavailable' | 'invalid-response', message: string) =>
  workspaceSessionFailureSchema.parse({ ok: false, failure: { kind, message } });

export function registerWorkspaceSession(
  dependencies: WorkspaceSessionDependencies,
): void {
  const snapshotByWindow = new WeakMap<BrowserWindow, WorkspaceSessionSnapshotWire | null>();

  dependencies.ipcMain.handle(WORKSPACE_SESSION_READ_CHANNEL, async (event) => {
    const senderWindow = authorizeSender(event, dependencies, WORKSPACE_SESSION_CAPABILITY);
    if (!senderWindow) {
      return failure('unauthorized', 'This window cannot restore workspace session state.');
    }
    try {
      let session = snapshotByWindow.get(senderWindow);
      if (!snapshotByWindow.has(senderWindow)) {
        session = dependencies.claimRestore(senderWindow)
          ? await dependencies.store.read()
          : null;
        snapshotByWindow.set(senderWindow, session);
      }
      return workspaceSessionReadResponseSchema.parse({
        ok: true,
        session,
      });
    } catch {
      return failure('unavailable', 'Workspace session state could not be restored.');
    }
  });

  dependencies.ipcMain.handle(WORKSPACE_SESSION_WRITE_CHANNEL, async (event, rawSnapshot) => {
    const senderWindow = authorizeSender(event, dependencies, WORKSPACE_SESSION_CAPABILITY);
    if (!senderWindow) {
      return failure('unauthorized', 'This window cannot persist workspace session state.');
    }
    const snapshot = workspaceSessionSnapshotSchema.safeParse(rawSnapshot);
    if (!snapshot.success) {
      return failure('invalid-response', 'The workspace session state was invalid.');
    }
    try {
      snapshotByWindow.set(senderWindow, snapshot.data);
      await dependencies.store.write(snapshot.data);
      return workspaceSessionWriteResponseSchema.parse({ ok: true });
    } catch {
      return failure('unavailable', 'Workspace session state could not be persisted.');
    }
  });
}

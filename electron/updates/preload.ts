import {
  UPDATES_CHECK_CHANNEL,
  UPDATES_OPEN_RELEASE_PAGE_CHANNEL,
  UPDATES_PRIMARY_ACTION_CHANNEL,
  UPDATES_READ_CHANNEL,
  UPDATES_SET_AUTO_CHECK_CHANNEL,
  UPDATES_SET_SIMULATION_CHANNEL,
  UPDATES_SNAPSHOT_CHANNEL,
  type UpdateSimulationValue,
  type UpdatesResult,
  type UpdatesSnapshot,
  updatesResultSchema,
  updatesSetAutoCheckRequestSchema,
  updatesSetSimulationRequestSchema,
  updatesSnapshotSchema,
} from '../../shared/protocols/electron/updates.ts';

export interface IpcRenderer {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, payload: unknown) => void): void;
}

export interface UpdatesPreload {
  check(): Promise<UpdatesResult>;
  onSnapshot(handler: (snapshot: UpdatesSnapshot) => void): () => void;
  openReleasePage(): Promise<UpdatesResult>;
  primaryAction(): Promise<UpdatesResult>;
  read(): Promise<UpdatesResult>;
  setAutoCheck(enabled: boolean): Promise<UpdatesResult>;
  setSimulation(value: UpdateSimulationValue): Promise<UpdatesResult>;
}

const failed = (): UpdatesResult => ({ ok: false, failure: { kind: 'failed' } });

const invalidRequest = (): UpdatesResult => ({ ok: false, failure: { kind: 'invalid-request' } });

export function createUpdatesPreload(ipcRenderer: IpcRenderer): UpdatesPreload {
  const handlers = new Set<(snapshot: UpdatesSnapshot) => void>();

  ipcRenderer.on(UPDATES_SNAPSHOT_CHANNEL, (_event, payload) => {
    const parsed = updatesSnapshotSchema.safeParse(payload);
    if (!parsed.success) return;
    for (const handler of handlers) handler(parsed.data);
  });

  /** A packaged build registers no simulation handler, so that channel
   *  rejects. Every rejection reads the same way here: main did not act. */
  const invoke = async (channel: string, payload?: unknown): Promise<UpdatesResult> => {
    try {
      const parsed = updatesResultSchema.safeParse(await ipcRenderer.invoke(channel, payload));
      return parsed.success ? parsed.data : failed();
    } catch {
      return failed();
    }
  };

  return Object.freeze({
    check() {
      return invoke(UPDATES_CHECK_CHANNEL);
    },
    onSnapshot(handler: (snapshot: UpdatesSnapshot) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    openReleasePage() {
      return invoke(UPDATES_OPEN_RELEASE_PAGE_CHANNEL);
    },
    primaryAction() {
      return invoke(UPDATES_PRIMARY_ACTION_CHANNEL);
    },
    read() {
      return invoke(UPDATES_READ_CHANNEL);
    },
    async setAutoCheck(enabled: boolean) {
      const request = updatesSetAutoCheckRequestSchema.safeParse({ enabled });
      if (!request.success) return invalidRequest();
      return invoke(UPDATES_SET_AUTO_CHECK_CHANNEL, request.data);
    },
    async setSimulation(value: UpdateSimulationValue) {
      const request = updatesSetSimulationRequestSchema.safeParse({ value });
      if (!request.success) return invalidRequest();
      return invoke(UPDATES_SET_SIMULATION_CHANNEL, request.data);
    },
  });
}

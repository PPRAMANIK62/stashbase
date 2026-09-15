import {
  PROJECT_ENTRY_REQUESTED_CHANNEL,
  PROJECT_ENTRY_CANCEL_CHANNEL,
  PROJECT_ENTRY_CANCELLED_CHANNEL,
  projectEntryStartSchema,
  projectEntryCancelSchema,
  PROJECT_ENTRY_PENDING_CHANNEL,
  PROJECT_ENTRY_FINISHED_CHANNEL,
  projectEntryRequestSchema,
  projectEntryPendingSchema,
  type ProjectEntryRequest,
  PROJECT_FOLDER_DIALOG_CHANNEL,
  PROJECT_FOLDER_REMOVAL_READY_CHANNEL,
  PROJECT_FOLDER_REMOVAL_REQUESTED_CHANNEL,
  PROJECT_FOLDER_REMOVED_CHANNEL,
  PROJECT_NOTIFY_FOLDER_REMOVED_CHANNEL,
  PROJECT_OPEN_FOLDER_WINDOW_CHANNEL,
  PROJECT_PREPARE_FOLDER_REMOVAL_CHANNEL,
  PROJECT_SET_ACTIVE_FOLDER_CHANNEL,
  type ProjectFolderDialogFailure,
  type ProjectFolderDialogRequest,
  type ProjectFolderDialogResponse,
  type ProjectLifecycleResponse,
  type ProjectOpenFolderWindowResponse,
  type ProjectPrepareFolderRemovalResponse,
  projectFolderPathRequestSchema,
  projectFolderDialogRequestSchema,
  projectFolderDialogResponseSchema,
  projectFolderRemovalReadySchema,
  projectFolderRemovalRequestedSchema,
  projectLifecycleResponseSchema,
  projectOpenFolderWindowResponseSchema,
  projectPrepareFolderRemovalResponseSchema,
  projectSetActiveFolderRequestSchema,
} from '../../shared/protocols/electron/project.ts';

export interface IpcRenderer {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, payload: unknown) => void): void;
}

export interface ProjectPreload {
  chooseFolder(
    request?: Partial<ProjectFolderDialogRequest>,
  ): Promise<ProjectFolderDialogResponse>;
  onEnterFolder(handler: (request: ProjectEntryRequest) => Promise<string | null>): () => void;
  notifyFolderRemoved(folderPath: string): Promise<ProjectLifecycleResponse>;
  cancelEntry(requestId: string): Promise<ProjectLifecycleResponse>;
  onEntryCancelled(handler: (requestId: string) => void): () => void;
  openFolderWindow(folderPath: string, requestId?: string): Promise<ProjectOpenFolderWindowResponse>;
  onFolderRemoved(handler: (folderPath: string) => void): () => void;
  onPrepareFolderRemoval(
    handler: (folderPath: string) => boolean | Promise<boolean>,
  ): () => void;
  prepareFolderRemoval(folderPath: string): Promise<ProjectPrepareFolderRemovalResponse>;
  setActiveFolder(folderPath: string | null): Promise<ProjectLifecycleResponse>;
}

const unavailable = (): ProjectFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'The folder picker is unavailable.',
  },
});

const invalidResponse = (): ProjectFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'invalid-response',
    message: 'The folder picker returned an invalid response.',
  },
});

const invalidLifecycleResponse = (): ProjectFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'invalid-response',
    message: 'The folder lifecycle returned an invalid response.',
  },
});

const lifecycleUnavailable = (): ProjectFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'The folder lifecycle is unavailable.',
  },
});

export function createProjectPreload(ipcRenderer: IpcRenderer): ProjectPreload {
  let entryHandler: ((request: ProjectEntryRequest) => Promise<string | null>) | null = null;
  const cancelledHandlers = new Set<(requestId: string) => void>();
  ipcRenderer.on(PROJECT_ENTRY_CANCELLED_CHANNEL, (_event, payload) => {
    const parsed = projectEntryCancelSchema.safeParse(payload);
    if (parsed.success) for (const handler of cancelledHandlers) handler(parsed.data.requestId);
  });
  const running = new Set<string>();
  async function receiveEntry(payload: unknown) {
    const parsed = projectEntryRequestSchema.safeParse(payload);
    if (!parsed.success || !entryHandler || running.has(parsed.data.requestId)) return;
    running.add(parsed.data.requestId);
    const request = parsed.data;
    let failure: string | null;
    try { failure = await entryHandler(request); }
    catch { failure = 'The project could not be opened. Try again.'; }
    try {
      await ipcRenderer.invoke(PROJECT_ENTRY_FINISHED_CHANNEL, { ...request, failure });
    } catch { /* Main reports its bounded readiness timeout to the caller. */ }
    finally { running.delete(request.requestId); }
  }
  ipcRenderer.on(PROJECT_ENTRY_REQUESTED_CHANNEL, (_event, payload) => { void receiveEntry(payload); });
  const folderRemovedHandlers = new Set<(folderPath: string) => void>();
  const prepareRemovalHandlers = new Set<
    (folderPath: string) => boolean | Promise<boolean>
  >();

  ipcRenderer.on(PROJECT_FOLDER_REMOVED_CHANNEL, (_event, payload) => {
    const parsed = projectFolderPathRequestSchema.safeParse(payload);
    if (!parsed.success) return;
    for (const handler of folderRemovedHandlers) handler(parsed.data.folderPath);
  });

  ipcRenderer.on(PROJECT_FOLDER_REMOVAL_REQUESTED_CHANNEL, (_event, payload) => {
    const request = projectFolderRemovalRequestedSchema.safeParse(payload);
    if (!request.success) return;
    void (async () => {
      let ready = prepareRemovalHandlers.size > 0;
      for (const handler of prepareRemovalHandlers) {
        try {
          if (await handler(request.data.folderPath) !== true) ready = false;
        } catch {
          ready = false;
        }
      }
      const response = projectFolderRemovalReadySchema.parse({ ...request.data, ready });
      try {
        await ipcRenderer.invoke(PROJECT_FOLDER_REMOVAL_READY_CHANNEL, response);
      } catch {
        // Main owns the bounded timeout when the acknowledgement cannot cross.
      }
    })();
  });

  async function invokeLifecycle(
    channel: string,
    payload: unknown,
  ): Promise<ProjectLifecycleResponse> {
    try {
      const response = await ipcRenderer.invoke(channel, payload);
      const parsed = projectLifecycleResponseSchema.safeParse(response);
      return parsed.success ? parsed.data : invalidLifecycleResponse();
    } catch {
      return lifecycleUnavailable();
    }
  }

  return Object.freeze({
    onEnterFolder(handler: (request: ProjectEntryRequest) => Promise<string | null>) {
      entryHandler = handler;
      void ipcRenderer.invoke(PROJECT_ENTRY_PENDING_CHANNEL).then((payload) => {
        const parsed = projectEntryPendingSchema.safeParse(payload);
        if (parsed.success && parsed.data) void receiveEntry(parsed.data);
      }).catch(() => {});
      return () => { if (entryHandler === handler) entryHandler = null; };
    },
    async chooseFolder(request = {}) {
      const parsedRequest = projectFolderDialogRequestSchema.parse(request);
      let response: unknown;
      try {
        response = await ipcRenderer.invoke(PROJECT_FOLDER_DIALOG_CHANNEL, parsedRequest);
      } catch {
        return unavailable();
      }
      const parsedResponse = projectFolderDialogResponseSchema.safeParse(response);
      return parsedResponse.success ? parsedResponse.data : invalidResponse();
    },
    notifyFolderRemoved(folderPath: string) {
      return invokeLifecycle(
        PROJECT_NOTIFY_FOLDER_REMOVED_CHANNEL,
        projectFolderPathRequestSchema.parse({ folderPath }),
      );
    },
    cancelEntry(requestId: string) {
      return invokeLifecycle(PROJECT_ENTRY_CANCEL_CHANNEL, projectEntryCancelSchema.parse({ requestId }));
    },
    onEntryCancelled(handler: (requestId: string) => void) {
      cancelledHandlers.add(handler);
      return () => cancelledHandlers.delete(handler);
    },
    async openFolderWindow(folderPath: string, requestId?: string) {
      const request = projectEntryStartSchema.parse({ folderPath, ...(requestId ? { requestId } : {}) });
      try {
        const response = await ipcRenderer.invoke(PROJECT_OPEN_FOLDER_WINDOW_CHANNEL, request);
        const parsed = projectOpenFolderWindowResponseSchema.safeParse(response);
        return parsed.success ? parsed.data : invalidLifecycleResponse();
      } catch {
        return lifecycleUnavailable();
      }
    },
    onFolderRemoved(handler: (folderPath: string) => void) {
      folderRemovedHandlers.add(handler);
      return () => folderRemovedHandlers.delete(handler);
    },
    onPrepareFolderRemoval(handler: (folderPath: string) => boolean | Promise<boolean>) {
      prepareRemovalHandlers.add(handler);
      return () => prepareRemovalHandlers.delete(handler);
    },
    async prepareFolderRemoval(folderPath: string) {
      const request = projectFolderPathRequestSchema.parse({ folderPath });
      try {
        const response = await ipcRenderer.invoke(
          PROJECT_PREPARE_FOLDER_REMOVAL_CHANNEL,
          request,
        );
        const parsed = projectPrepareFolderRemovalResponseSchema.safeParse(response);
        return parsed.success ? parsed.data : invalidLifecycleResponse();
      } catch {
        return lifecycleUnavailable();
      }
    },
    setActiveFolder(folderPath: string | null) {
      return invokeLifecycle(
        PROJECT_SET_ACTIVE_FOLDER_CHANNEL,
        projectSetActiveFolderRequestSchema.parse({ folderPath }),
      );
    },
  });
}

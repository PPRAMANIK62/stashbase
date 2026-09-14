import {
  PROJECT_CLAIM_INITIAL_FOLDER_CHANNEL,
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
  type ProjectInitialFolderResponse,
  type ProjectLifecycleResponse,
  type ProjectOpenFolderWindowResponse,
  type ProjectPrepareFolderRemovalResponse,
  projectFolderPathRequestSchema,
  projectFolderDialogRequestSchema,
  projectFolderDialogResponseSchema,
  projectFolderRemovalReadySchema,
  projectFolderRemovalRequestedSchema,
  projectInitialFolderResponseSchema,
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
  claimInitialFolder(): Promise<ProjectInitialFolderResponse>;
  notifyFolderRemoved(folderPath: string): Promise<ProjectLifecycleResponse>;
  openFolderWindow(folderPath: string): Promise<ProjectOpenFolderWindowResponse>;
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
    async claimInitialFolder() {
      try {
        const response = await ipcRenderer.invoke(PROJECT_CLAIM_INITIAL_FOLDER_CHANNEL);
        const parsed = projectInitialFolderResponseSchema.safeParse(response);
        return parsed.success ? parsed.data : invalidLifecycleResponse();
      } catch {
        return lifecycleUnavailable();
      }
    },
    notifyFolderRemoved(folderPath: string) {
      return invokeLifecycle(
        PROJECT_NOTIFY_FOLDER_REMOVED_CHANNEL,
        projectFolderPathRequestSchema.parse({ folderPath }),
      );
    },
    async openFolderWindow(folderPath: string) {
      const request = projectFolderPathRequestSchema.parse({ folderPath });
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

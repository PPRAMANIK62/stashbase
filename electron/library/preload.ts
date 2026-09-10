import {
  LIBRARY_CLAIM_INITIAL_FOLDER_CHANNEL,
  LIBRARY_FOLDER_DIALOG_CHANNEL,
  LIBRARY_FOLDER_REMOVAL_READY_CHANNEL,
  LIBRARY_FOLDER_REMOVAL_REQUESTED_CHANNEL,
  LIBRARY_FOLDER_REMOVED_CHANNEL,
  LIBRARY_NOTIFY_FOLDER_REMOVED_CHANNEL,
  LIBRARY_OPEN_FOLDER_WINDOW_CHANNEL,
  LIBRARY_PREPARE_FOLDER_REMOVAL_CHANNEL,
  LIBRARY_SET_ACTIVE_FOLDER_CHANNEL,
  type LibraryFolderDialogFailure,
  type LibraryFolderDialogRequest,
  type LibraryFolderDialogResponse,
  type LibraryInitialFolderResponse,
  type LibraryLifecycleResponse,
  type LibraryOpenFolderWindowResponse,
  type LibraryPrepareFolderRemovalResponse,
  libraryFolderPathRequestSchema,
  libraryFolderDialogRequestSchema,
  libraryFolderDialogResponseSchema,
  libraryFolderRemovalReadySchema,
  libraryFolderRemovalRequestedSchema,
  libraryInitialFolderResponseSchema,
  libraryLifecycleResponseSchema,
  libraryOpenFolderWindowResponseSchema,
  libraryPrepareFolderRemovalResponseSchema,
  librarySetActiveFolderRequestSchema,
} from '../../shared/protocols/electron/library.ts';

export interface IpcRenderer {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, payload: unknown) => void): void;
}

export interface LibraryPreload {
  chooseFolder(
    request?: Partial<LibraryFolderDialogRequest>,
  ): Promise<LibraryFolderDialogResponse>;
  claimInitialFolder(): Promise<LibraryInitialFolderResponse>;
  notifyFolderRemoved(folderPath: string): Promise<LibraryLifecycleResponse>;
  openFolderWindow(folderPath: string): Promise<LibraryOpenFolderWindowResponse>;
  onFolderRemoved(handler: (folderPath: string) => void): () => void;
  onPrepareFolderRemoval(
    handler: (folderPath: string) => boolean | Promise<boolean>,
  ): () => void;
  prepareFolderRemoval(folderPath: string): Promise<LibraryPrepareFolderRemovalResponse>;
  setActiveFolder(folderPath: string | null): Promise<LibraryLifecycleResponse>;
}

const unavailable = (): LibraryFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'The folder picker is unavailable.',
  },
});

const invalidResponse = (): LibraryFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'invalid-response',
    message: 'The folder picker returned an invalid response.',
  },
});

const invalidLifecycleResponse = (): LibraryFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'invalid-response',
    message: 'The folder lifecycle returned an invalid response.',
  },
});

const lifecycleUnavailable = (): LibraryFolderDialogFailure => ({
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'The folder lifecycle is unavailable.',
  },
});

export function createLibraryPreload(ipcRenderer: IpcRenderer): LibraryPreload {
  const folderRemovedHandlers = new Set<(folderPath: string) => void>();
  const prepareRemovalHandlers = new Set<
    (folderPath: string) => boolean | Promise<boolean>
  >();

  ipcRenderer.on(LIBRARY_FOLDER_REMOVED_CHANNEL, (_event, payload) => {
    const parsed = libraryFolderPathRequestSchema.safeParse(payload);
    if (!parsed.success) return;
    for (const handler of folderRemovedHandlers) handler(parsed.data.folderPath);
  });

  ipcRenderer.on(LIBRARY_FOLDER_REMOVAL_REQUESTED_CHANNEL, (_event, payload) => {
    const request = libraryFolderRemovalRequestedSchema.safeParse(payload);
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
      const response = libraryFolderRemovalReadySchema.parse({ ...request.data, ready });
      try {
        await ipcRenderer.invoke(LIBRARY_FOLDER_REMOVAL_READY_CHANNEL, response);
      } catch {
        // Main owns the bounded timeout when the acknowledgement cannot cross.
      }
    })();
  });

  async function invokeLifecycle(
    channel: string,
    payload: unknown,
  ): Promise<LibraryLifecycleResponse> {
    try {
      const response = await ipcRenderer.invoke(channel, payload);
      const parsed = libraryLifecycleResponseSchema.safeParse(response);
      return parsed.success ? parsed.data : invalidLifecycleResponse();
    } catch {
      return lifecycleUnavailable();
    }
  }

  return Object.freeze({
    async chooseFolder(request = {}) {
      const parsedRequest = libraryFolderDialogRequestSchema.parse(request);
      let response: unknown;
      try {
        response = await ipcRenderer.invoke(LIBRARY_FOLDER_DIALOG_CHANNEL, parsedRequest);
      } catch {
        return unavailable();
      }
      const parsedResponse = libraryFolderDialogResponseSchema.safeParse(response);
      return parsedResponse.success ? parsedResponse.data : invalidResponse();
    },
    async claimInitialFolder() {
      try {
        const response = await ipcRenderer.invoke(LIBRARY_CLAIM_INITIAL_FOLDER_CHANNEL);
        const parsed = libraryInitialFolderResponseSchema.safeParse(response);
        return parsed.success ? parsed.data : invalidLifecycleResponse();
      } catch {
        return lifecycleUnavailable();
      }
    },
    notifyFolderRemoved(folderPath: string) {
      return invokeLifecycle(
        LIBRARY_NOTIFY_FOLDER_REMOVED_CHANNEL,
        libraryFolderPathRequestSchema.parse({ folderPath }),
      );
    },
    async openFolderWindow(folderPath: string) {
      const request = libraryFolderPathRequestSchema.parse({ folderPath });
      try {
        const response = await ipcRenderer.invoke(LIBRARY_OPEN_FOLDER_WINDOW_CHANNEL, request);
        const parsed = libraryOpenFolderWindowResponseSchema.safeParse(response);
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
      const request = libraryFolderPathRequestSchema.parse({ folderPath });
      try {
        const response = await ipcRenderer.invoke(
          LIBRARY_PREPARE_FOLDER_REMOVAL_CHANNEL,
          request,
        );
        const parsed = libraryPrepareFolderRemovalResponseSchema.safeParse(response);
        return parsed.success ? parsed.data : invalidLifecycleResponse();
      } catch {
        return lifecycleUnavailable();
      }
    },
    setActiveFolder(folderPath: string | null) {
      return invokeLifecycle(
        LIBRARY_SET_ACTIVE_FOLDER_CHANNEL,
        librarySetActiveFolderRequestSchema.parse({ folderPath }),
      );
    },
  });
}

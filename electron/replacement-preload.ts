import { contextBridge, ipcRenderer } from 'electron';

import { createWorkspacePreloadApi } from './workspace-preload-api.ts';

contextBridge.exposeInMainWorld(
  'stashbase',
  Object.freeze({
    workspace: createWorkspacePreloadApi(ipcRenderer),
  }),
);

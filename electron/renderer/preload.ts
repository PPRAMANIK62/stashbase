import { contextBridge, ipcRenderer } from 'electron';

import { createLibraryPreload } from '../library/preload.ts';
import { createWorkspaceSessionPreload } from '../workspace/preload.ts';
import { createRuntimeConfig } from './runtime.ts';

contextBridge.exposeInMainWorld(
  'stashbase',
  Object.freeze({
    runtime: createRuntimeConfig(process.argv),
    library: createLibraryPreload(ipcRenderer),
    workspaceSession: createWorkspaceSessionPreload(ipcRenderer),
  }),
);

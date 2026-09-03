import { contextBridge, ipcRenderer } from 'electron';

import { createExternalNavigationPreload } from '../external-navigation/preload.ts';
import { createLibraryPreload } from '../library/preload.ts';
import { createWorkspaceSessionPreload } from '../workspace/preload.ts';
import { createWindowLifecyclePreload } from '../window/preload.ts';
import { createRuntimeConfig } from './runtime.ts';

contextBridge.exposeInMainWorld(
  'stashbase',
  Object.freeze({
    externalNavigation: createExternalNavigationPreload(ipcRenderer),
    runtime: createRuntimeConfig(process.argv),
    library: createLibraryPreload(ipcRenderer),
    workspaceSession: createWorkspaceSessionPreload(ipcRenderer),
    windowLifecycle: createWindowLifecyclePreload(ipcRenderer),
  }),
);

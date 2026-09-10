import { contextBridge, ipcRenderer } from 'electron';

import { createBugReportPreload } from '../bug-report/preload.ts';
import { createCapturePreload } from '../capture/preload.ts';
import { createExternalNavigationPreload } from '../external-navigation/preload.ts';
import { createLibraryPreload } from '../library/preload.ts';
import { createUpdatesPreload } from '../updates/preload.ts';
import { createWorkspaceSessionPreload } from '../workspace/preload.ts';
import { createWindowLifecyclePreload } from '../window/preload.ts';
import { createRuntimeConfig } from './runtime.ts';

contextBridge.exposeInMainWorld(
  'stashbase',
  Object.freeze({
    bugReport: createBugReportPreload(ipcRenderer),
    capture: createCapturePreload(ipcRenderer),
    externalNavigation: createExternalNavigationPreload(ipcRenderer),
    runtime: createRuntimeConfig(process.argv),
    library: createLibraryPreload(ipcRenderer),
    workspaceSession: createWorkspaceSessionPreload(ipcRenderer),
    windowLifecycle: createWindowLifecyclePreload(ipcRenderer),
    updates: createUpdatesPreload(ipcRenderer),
  }),
);

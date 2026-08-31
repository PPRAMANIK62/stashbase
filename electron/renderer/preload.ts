import { contextBridge, ipcRenderer } from 'electron';

import { createLibraryPreload } from '../library/preload.ts';
import { createRuntimeConfig } from './runtime.ts';

contextBridge.exposeInMainWorld(
  'stashbase',
  Object.freeze({
    runtime: createRuntimeConfig(process.argv),
    library: createLibraryPreload(ipcRenderer),
  }),
);

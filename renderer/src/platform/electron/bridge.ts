import {
  type RendererRuntimeConfig,
  rendererRuntimeConfigSchema,
} from '@/protocols/electron/runtime';

import type { LibraryBridge } from './folder-picker';
import type { LibraryLifecycleBridge } from './library-lifecycle';

interface DesktopLibraryBridge extends LibraryBridge, LibraryLifecycleBridge {}

interface DesktopBridge {
  library: DesktopLibraryBridge;
  runtime: RendererRuntimeConfig;
}

declare global {
  interface Window {
    stashbase?: {
      library?: DesktopLibraryBridge;
      runtime?: unknown;
    };
  }
}

export function readBridge(globalWindow: Window = window): DesktopBridge {
  const runtime = rendererRuntimeConfigSchema.parse(globalWindow.stashbase?.runtime);
  const library = globalWindow.stashbase?.library;
  if (
    !library ||
    typeof library.chooseFolder !== 'function' ||
    typeof library.notifyFolderRemoved !== 'function' ||
    typeof library.onFolderRemoved !== 'function' ||
    typeof library.onPrepareFolderRemoval !== 'function' ||
    typeof library.prepareFolderRemoval !== 'function' ||
    typeof library.setActiveFolder !== 'function'
  ) {
    throw new Error('The library folder picker is unavailable.');
  }
  return { library, runtime };
}

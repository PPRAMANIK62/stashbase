import {
  type RendererRuntimeConfig,
  rendererRuntimeConfigSchema,
} from '@/protocols/electron/runtime';

import type { LibraryBridge } from './folder-picker';

interface DesktopBridge {
  library: LibraryBridge;
  runtime: RendererRuntimeConfig;
}

declare global {
  interface Window {
    stashbase?: {
      library?: LibraryBridge;
      runtime?: unknown;
    };
  }
}

export function readBridge(globalWindow: Window = window): DesktopBridge {
  const runtime = rendererRuntimeConfigSchema.parse(globalWindow.stashbase?.runtime);
  const library = globalWindow.stashbase?.library;
  if (!library || typeof library.chooseFolder !== 'function') {
    throw new Error('The library folder picker is unavailable.');
  }
  return { library, runtime };
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

await build({
  absWorkingDir: repositoryRoot,
  bundle: true,
  entryPoints: {
    'bug-report/open': 'electron/bug-report/open.ts',
    'bug-report/preload': 'electron/bug-report/preload.ts',
    'bug-report/review-ipc': 'electron/bug-report/review-ipc.ts',
    'bug-report/review-preload': 'electron/bug-report/review-preload.ts',
    'bug-report/review-window-preload': 'electron/bug-report/review-window-preload.ts',
    'capture/monitor': 'electron/capture/monitor.ts',
    'capture/preload': 'electron/capture/preload.ts',
    'external-navigation/handler': 'electron/external-navigation/handler.ts',
    'external-navigation/preload': 'electron/external-navigation/preload.ts',
    'library/dialog': 'electron/library/dialog.ts',
    'library/lifecycle': 'electron/library/lifecycle.ts',
    'library/preload': 'electron/library/preload.ts',
    'renderer/preload': 'electron/renderer/preload.ts',
    'renderer/runtime': 'electron/renderer/runtime.ts',
    'updates/ipc': 'electron/updates/ipc.ts',
    'updates/preload': 'electron/updates/preload.ts',
    'workspace/preload': 'electron/workspace/preload.ts',
    'workspace/session': 'electron/workspace/session.ts',
    'window/lifecycle': 'electron/window/lifecycle.ts',
    'window/preload': 'electron/window/preload.ts',
  },
  external: ['electron'],
  format: 'cjs',
  logLevel: 'info',
  outdir: 'dist/electron',
  outExtension: { '.js': '.cjs' },
  platform: 'node',
  sourcemap: false,
  target: 'node22',
});

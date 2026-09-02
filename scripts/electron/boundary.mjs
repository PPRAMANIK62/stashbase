import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

await build({
  absWorkingDir: repositoryRoot,
  bundle: true,
  entryPoints: {
    'library/dialog': 'electron/library/dialog.ts',
    'library/lifecycle': 'electron/library/lifecycle.ts',
    'library/preload': 'electron/library/preload.ts',
    'renderer/preload': 'electron/renderer/preload.ts',
    'renderer/runtime': 'electron/renderer/runtime.ts',
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

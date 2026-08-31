import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  absWorkingDir: repositoryRoot,
  bundle: true,
  entryPoints: {
    'replacement-preload': 'electron/replacement-preload.ts',
    'workspace-folder-dialog-ipc': 'electron/workspace-folder-dialog-ipc.ts',
    'workspace-preload-api': 'electron/workspace-preload-api.ts',
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

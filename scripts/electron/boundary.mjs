import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

await build({
  absWorkingDir: repositoryRoot,
  bundle: true,
  entryPoints: {
    'library/dialog': 'electron/library/dialog.ts',
    'library/preload': 'electron/library/preload.ts',
    'renderer/preload': 'electron/renderer/preload.ts',
    'renderer/runtime': 'electron/renderer/runtime.ts',
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

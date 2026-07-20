import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite dev server lives at :5173, but **Electron only ever loads :8090**.
 * The Express server proxies non-API requests to us, so users never see
 * two ports. Build output lands under `web/dist-app/` and Express
 * serves it as a static bundle in production.
 *
 * `root` is pinned to this directory because `pnpm dev:web` is
 * launched from the project root — Vite's default `root = cwd` would
 * otherwise look for `index.html` in the wrong place.
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../web/dist-app',
    emptyOutDir: true,
    manifest: true,
  },
});

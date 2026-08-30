import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';

const rendererRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rendererRoot, 'src'),
    },
  },
  fmt: {
    singleQuote: true,
    semi: true,
    sortPackageJson: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../web/dist-app',
    emptyOutDir: true,
    manifest: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: [
      {
        find: /^@\/protocols\//u,
        replacement: fileURLToPath(new URL('../shared/protocols/', import.meta.url)),
      },
      {
        find: '@/shared/file-formats',
        replacement: fileURLToPath(new URL('../shared/file-formats.ts', import.meta.url)),
      },
      {
        find: '@/shared/html-sanitization',
        replacement: fileURLToPath(new URL('../shared/html-sanitization.ts', import.meta.url)),
      },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  fmt: {
    arrowParens: 'always',
    bracketSameLine: false,
    bracketSpacing: true,
    endOfLine: 'lf',
    insertFinalNewline: true,
    jsxSingleQuote: false,
    printWidth: 100,
    quoteProps: 'as-needed',
    sortImports: true,
    singleQuote: true,
    semi: true,
    sortPackageJson: false,
    sortTailwindcss: {
      stylesheet: './src/globals.css',
      functions: ['cn', 'cva'],
    },
    tabWidth: 2,
    trailingComma: 'all',
    useTabs: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../dist/renderer',
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

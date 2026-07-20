import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(repoRoot, 'web', 'dist-app');
const manifestPath = path.join(outputRoot, '.vite', 'manifest.json');
const expectedEntries = [
  'src/components/ChatPane.tsx',
  'src/components/MarkdownPreview.tsx',
  'src/components/PdfPreview.tsx',
  'src/components/DocxPreview.tsx',
  'src/components/CodeEditor.tsx',
];

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const source of expectedEntries) {
  const entry = manifest[source];
  if (!entry?.isDynamicEntry) {
    throw new Error(`renderer build is missing dynamic entry: ${source}`);
  }
  const chunkPath = path.join(outputRoot, entry.file);
  if (!fs.statSync(chunkPath).isFile() || fs.statSync(chunkPath).size === 0) {
    throw new Error(`renderer dynamic chunk is missing or empty: ${entry.file}`);
  }
}

console.log(`[renderer-chunks] verified ${expectedEntries.length} dynamic entries`);

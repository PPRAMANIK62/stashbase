import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mergeMacArtifacts } from './packaging/macos-artifacts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'release.nosync');
await mergeMacArtifacts({
  directories: Object.fromEntries(['arm64', 'x64'].map((arch) => [arch, path.join(output, 'macos-builds', `macos-${arch}`)])),
  output, version: pkg.version, productName: pkg.build.productName,
});
console.log('[release] verified and merged arm64 + x64 macOS artifacts');

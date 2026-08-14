import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packagedFiles = pkg.build?.files ?? [];

function packaged(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  return packagedFiles.some((entry) => {
    if (typeof entry !== 'string' || entry.startsWith('!')) return false;
    if (entry.endsWith('/**/*')) return normalized.startsWith(entry.slice(0, -4));
    if (entry.endsWith('/**')) return normalized.startsWith(entry.slice(0, -3));
    return normalized === entry;
  });
}

function cjsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return cjsFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.cjs') ? [absolute] : [];
  });
}

test('electron-builder includes local CommonJS dependencies outside electron/', () => {
  const missing = [];
  const relativeRequire = /require\(\s*['"](\.\.\/[^'"]+)['"]\s*\)/g;

  for (const source of cjsFiles(path.join(root, 'electron'))) {
    const content = fs.readFileSync(source, 'utf8');
    for (const match of content.matchAll(relativeRequire)) {
      const dependency = path.resolve(path.dirname(source), match[1]);
      const relative = path.relative(root, dependency);
      if (!fs.existsSync(dependency) || packaged(relative)) continue;
      missing.push(`${path.relative(root, source)} -> ${relative}`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `package.json build.files omits Electron runtime dependencies:\n${missing.join('\n')}`,
  );
});

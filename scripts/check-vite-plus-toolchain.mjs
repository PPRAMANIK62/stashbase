import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function normalizeToolchain(inventory) {
  assert.equal(inventory?.schemaVersion, 1, 'unsupported Vite+ toolchain schema');
  assert.equal(inventory?.source?.scope, 'local', 'toolchain must come from local Vite+');
  assert.equal(typeof inventory.source.vitePlusVersion, 'string');
  assert.ok(Array.isArray(inventory.nodes), 'toolchain nodes must be an array');
  assert.ok(Array.isArray(inventory.edges), 'toolchain edges must be an array');

  const normalized = structuredClone(inventory);
  delete normalized.source.path;
  return normalized;
}

export function readLocalToolchain() {
  const executable = path.join(root, 'node_modules', 'vite-plus', 'bin', 'vp');
  const stdout = execFileSync(process.execPath, [executable, 'toolchain', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  return JSON.parse(stdout);
}

export function verifyToolchain() {
  const expectedPath = path.join(root, 'toolchain', 'vite-plus.json');
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const actual = normalizeToolchain(readLocalToolchain());

  assert.deepEqual(
    actual,
    expected,
    'resolved Vite+ toolchain differs from toolchain/vite-plus.json',
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === invokedPath) {
  verifyToolchain();
  console.log('Vite+ resolved toolchain matches toolchain/vite-plus.json');
}

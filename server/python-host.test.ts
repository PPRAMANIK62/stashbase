import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const root = tmpDir('python-host-root');
const resources = path.join(root, 'Resources');
const appRoot = path.join(resources, 'app.asar');
const script = path.join(resources, 'python', 'pdf_extract.py');

fs.mkdirSync(path.dirname(script), { recursive: true });
fs.writeFileSync(script, '# extractor fixture\n');

process.env.STASHBASE_APP_ROOT = appRoot;
process.env.STASHBASE_RESOURCES_PATH = resources;
delete process.env.STASHBASE_DEV_VITE;
delete process.env.STASHBASE_EXTRACT_BIN;
delete process.env.STASHBASE_PYTHON;

const host = await import('./python-host.ts');

test('packaged extractor resolution is explicit about optional local extraction', () => {
  assert.throws(
    () => host.extractorSpawn('pdf', 'pdf_extract.py', ['input.pdf', 'out.md', 'out_files']),
    /PDF extractor is not bundled/,
  );

  process.env.STASHBASE_PYTHON = '/opt/stashbase/python';
  assert.deepEqual(host.extractorSpawn('pdf', 'pdf_extract.py', ['input.pdf']).args, [
    script,
    'input.pdf',
  ]);
  assert.equal(host.extractorSpawn('pdf', 'pdf_extract.py', ['input.pdf']).cmd, '/opt/stashbase/python');
  delete process.env.STASHBASE_PYTHON;

  const bin = path.join(resources, 'python', 'sidecar', 'stashbase-extract', 'stashbase-extract');
  fs.mkdirSync(path.dirname(bin), { recursive: true });
  fs.writeFileSync(bin, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(bin, 0o755);

  assert.deepEqual(host.extractorSpawn('ocr', 'ocr_extract.py', ['shot.png', 'shot.md']), {
    cmd: bin,
    args: ['ocr', 'shot.png', 'shot.md'],
  });
});

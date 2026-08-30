import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { findFrontendBoundaryViolations } from './check-frontend-boundaries.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-frontend-boundary-'));
  fs.mkdirSync(path.join(root, 'renderer', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'web-src', 'src'), { recursive: true });
  return root;
}

test('isolated frontend trees pass', (context) => {
  const root = fixture();
  context.after(() => fs.rmSync(root, { recursive: true }));
  fs.writeFileSync(path.join(root, 'renderer', 'src', 'entry.ts'), "import './app';\n");

  assert.deepEqual(findFrontendBoundaryViolations(root), []);
});

test('the supported renderer cannot depend on the reference tree', (context) => {
  const root = fixture();
  context.after(() => fs.rmSync(root, { recursive: true }));
  fs.writeFileSync(path.join(root, 'renderer', 'src', 'entry.ts'), "import '../../web-src/src/app';\n");

  assert.deepEqual(findFrontendBoundaryViolations(root), [
    'renderer/src/entry.ts references web-src',
  ]);
});

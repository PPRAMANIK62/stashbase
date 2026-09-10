// The size gate is only useful if its allowlist ratchets. These cases pin the
// three ways it fails — over the limit, over a granted ceiling, and an
// exemption the code no longer needs — plus the files it deliberately ignores.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { LIMIT, TEST_LIMIT, findRendererSizeViolations } from './size.mjs';

function write(root, relativePath, lines) {
  const absolutePath = path.join(root, 'renderer/src', relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'export const filler = 1;\n'.repeat(lines - 1));
}

function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-renderer-size-'));
  context.after(() => fs.rmSync(root, { recursive: true }));
  fs.mkdirSync(path.join(root, 'renderer/src'), { recursive: true });
  return root;
}

test('files at or under their limit pass, and stories are never measured', (context) => {
  const root = fixture(context);
  write(root, 'lib/small.ts', 10);
  write(root, 'app/at-the-limit.tsx', LIMIT);
  write(root, 'features/workspace/ui/panel.test.tsx', TEST_LIMIT);
  write(root, 'features/workspace/ui/panel.stories.tsx', LIMIT * 3);

  assert.deepEqual(findRendererSizeViolations(root, new Map()), []);
});

test('an oversized file without an exemption fails against the shared limit', (context) => {
  const root = fixture(context);
  write(root, 'features/workspace/ui/panel.tsx', LIMIT + 12);

  assert.deepEqual(findRendererSizeViolations(root, new Map()), [
    `features/workspace/ui/panel.tsx: ${LIMIT + 12} lines, over the ${LIMIT}-line limit`,
  ]);
});

test('an exempt file is held to its own ceiling', (context) => {
  const root = fixture(context);
  write(root, 'app/shell.tsx', 545);
  assert.deepEqual(findRendererSizeViolations(root, new Map([['app/shell.tsx', 545]])), []);

  write(root, 'app/shell.tsx', 546);
  assert.deepEqual(findRendererSizeViolations(root, new Map([['app/shell.tsx', 545]])), [
    'app/shell.tsx: 546 lines, over its ceiling of 545',
  ]);
});

test('the allowlist only shrinks: a recovered or deleted entry fails', (context) => {
  const root = fixture(context);
  write(root, 'app/shell.tsx', 120);

  assert.deepEqual(
    findRendererSizeViolations(
      root,
      new Map([
        ['app/shell.tsx', 545],
        ['app/retired.tsx', 500],
      ]),
    ),
    [
      'app/retired.tsx: allowlisted but missing',
      'app/shell.tsx: 120 lines, remove its allowlist entry',
    ],
  );
});

test('a test file is measured against its own limit', (context) => {
  const root = fixture(context);
  write(root, 'features/workspace/ui/panel.test.tsx', TEST_LIMIT + 1);
  assert.deepStrictEqual(findRendererSizeViolations(root, new Map()), [
    `features/workspace/ui/panel.test.tsx: ${TEST_LIMIT + 1} lines, over the ${TEST_LIMIT}-line limit`,
  ]);
});

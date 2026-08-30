import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { findRendererStyleViolations } from './check-renderer-styles.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const contract = {
  canonicalStylesheet: 'renderer/src/globals.css',
  foundationTokens: ['--neutral-0', '--duration-1', '--easing-1', '--corner-base'],
  semanticTokens: [
    '--background',
    '--motion-duration-standard',
    '--motion-ease-out',
    '--corner-md',
    '--elevation-raised',
  ],
  tailwindTokens: ['--color-background', '--radius-md', '--shadow-raised', '--ease-standard'],
  utilities: ['duration-standard'],
};

const approvedStyles = `
@theme inline {
  --color-background: var(--background);
  --radius-md: var(--corner-md);
  --shadow-raised: var(--elevation-raised);
  --ease-standard: var(--motion-ease-out);
}

@utility duration-standard {
  transition-duration: var(--motion-duration-standard);
}

:root {
  --neutral-0: oklch(1 0 0);
  --duration-1: 180ms;
  --easing-1: ease-out;
  --corner-base: 0.375rem;
  --background: var(--neutral-0);
  --motion-duration-standard: var(--duration-1);
  --motion-ease-out: var(--easing-1);
  --corner-md: var(--corner-base);
  --elevation-raised: 0 1px 2px color-mix(in oklch, var(--neutral-0) 10%, transparent);
}
`;

function write(root, relativePath, source) {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source);
}

function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-renderer-styles-'));
  context.after(() => fs.rmSync(root, { recursive: true }));
  write(root, 'renderer/style-contract.json', `${JSON.stringify(contract, null, 2)}\n`);
  write(root, 'renderer/src/globals.css', approvedStyles);
  return root;
}

test('approved semantic roles pass the renderer style contract', (context) => {
  const root = fixture(context);
  write(
    root,
    'renderer/src/view.tsx',
    `export const View = () => (
      <div className="bg-background rounded-md shadow-raised duration-standard ease-standard" />
    );\n`,
  );

  assert.deepEqual(findRendererStyleViolations(root), []);
});

test('source scans reject raw, arbitrary, inline, and undeclared visual styling', (context) => {
  const root = fixture(context);
  write(
    root,
    'renderer/src/unsafe-view.tsx',
    `const missing = 'var(--missing)';
    const detachedClass = 'bg-detached';
    export const View = () => (
      <div
        className="bg-red-500 bg-brand grid-cols-[13px_1fr] shadow rounded-card duration-slow ease-bouncy opacity-50 text-xs z-50"
        style={{ color: '#fff' }}
      />
    );
    export { detachedClass, missing };\n`,
  );
  write(root, 'renderer/src/unsafe-view.css', '.view { color: red; }\n');

  const violations = findRendererStyleViolations(root);
  for (const expected of [
    'renderer/src/unsafe-view.css is forbidden; renderer CSS belongs in renderer/src/globals.css',
    'renderer/src/unsafe-view.tsx contains a raw color literal',
    'renderer/src/unsafe-view.tsx references undeclared token --missing',
    'renderer/src/unsafe-view.tsx uses an inline style prop',
    'renderer/src/unsafe-view.tsx uses arbitrary visual utility grid-cols-[13px_1fr]',
    'renderer/src/unsafe-view.tsx uses raw palette utility bg-red-500',
    'renderer/src/unsafe-view.tsx uses undeclared color role bg-brand',
    'renderer/src/unsafe-view.tsx uses undeclared color role bg-detached',
    'renderer/src/unsafe-view.tsx uses undeclared duration role duration-slow',
    'renderer/src/unsafe-view.tsx uses undeclared easing role ease-bouncy',
    'renderer/src/unsafe-view.tsx uses undeclared opacity role opacity-50',
    'renderer/src/unsafe-view.tsx uses undeclared radius role rounded-card',
    'renderer/src/unsafe-view.tsx uses undeclared shadow role shadow',
    'renderer/src/unsafe-view.tsx uses undeclared stacking role z-50',
    'renderer/src/unsafe-view.tsx uses undeclared text role text-xs',
  ]) {
    assert.ok(violations.includes(expected), `missing ${expected}:\n${violations.join('\n')}`);
  }
});

test('the canonical stylesheet cannot bypass approved token ownership', (context) => {
  const root = fixture(context);
  write(
    root,
    'renderer/src/globals.css',
    approvedStyles
      .replace('  --background: var(--neutral-0);', '  --background: oklch(1 0 0);')
      .replace('  --corner-md: var(--corner-base);\n', '')
      .replace('  --color-background: var(--background);', '  --color-background: oklch(1 0 0);')
      .replace('@utility duration-standard', '@utility duration-rogue')
      .replace('\n}', '\n  --rogue: var(--missing);\n}') + '.rogue {\n  color: red;\n}\n',
  );

  const violations = findRendererStyleViolations(root);
  for (const expected of [
    'renderer/src/globals.css declares unapproved token --rogue',
    'renderer/src/globals.css maps semantic color --background from a raw literal',
    'renderer/src/globals.css omits approved token --corner-md',
    'renderer/src/globals.css omits approved utility duration-standard',
    'renderer/src/globals.css references undeclared token --missing',
    'renderer/src/globals.css Tailwind token --color-background must map an approved role',
    'renderer/src/globals.css declares unapproved utility duration-rogue',
    'renderer/src/globals.css sets raw color value red',
  ]) {
    assert.ok(violations.includes(expected), `missing ${expected}:\n${violations.join('\n')}`);
  }
});

test('renderer validation commands enforce the style contract', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));

  assert.equal(pkg.scripts['check:renderer-styles'], 'node scripts/check-renderer-styles.mjs');
  assert.equal(
    pkg.scripts['test:renderer-styles'],
    'node --test scripts/check-renderer-styles.test.mjs && pnpm check:renderer-styles',
  );
  for (const script of ['build:web', 'lint:web']) {
    assert.match(pkg.scripts[script], /pnpm check:renderer-styles/);
  }
  assert.match(pkg.scripts['test:renderer'], /pnpm test:renderer-styles/);
});

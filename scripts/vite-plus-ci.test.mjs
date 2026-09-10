import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { gates } from './renderer/check-web.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const setupAction = 'voidzero-dev/setup-vp@1b32467adbe183473499fd9d5d372c3ed9641754';
const rendererJobs = new Map([
  ['.github/workflows/ci.yml', ['source-build']],
  ['.github/workflows/release-macos.yml', ['macos-dmg']],
  ['.github/workflows/release-linux.yml', ['linux-packages']],
  ['.github/workflows/release-windows.yml', ['windows-installer']],
]);

function readWorkflow(relativePath) {
  return parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('source and release renderer builds use the same pinned Vite+ setup', () => {
  for (const [relativePath, jobNames] of rendererJobs) {
    const workflow = readWorkflow(relativePath);
    for (const jobName of jobNames) {
      const steps = workflow.jobs?.[jobName]?.steps ?? [];
      const setupSteps = steps.filter((step) => step.uses?.startsWith('voidzero-dev/setup-vp@'));
      const setupIndex = steps.findIndex((step) => step.uses?.startsWith('voidzero-dev/setup-vp@'));
      const installIndex = steps.findIndex((step) => step.run === 'pnpm install --frozen-lockfile');

      assert.equal(setupSteps.length, 1, `${relativePath} ${jobName} must set up Vite+ once`);
      assert.deepEqual(
        setupSteps[0],
        {
          uses: setupAction,
          with: {
            version: '0.3.0',
            'node-manager': false,
            'run-install': false,
            cache: false,
          },
        },
        `${relativePath} ${jobName} must use the reviewed Vite+ setup policy`,
      );
      assert.ok(installIndex > setupIndex, `${relativePath} ${jobName} must set up Vite+ before install`);
    }
  }
});

test('source CI runs the replacement gate before the broader application matrix', () => {
  const workflow = readWorkflow('.github/workflows/ci.yml');
  const steps = workflow.jobs?.['source-build']?.steps ?? [];
  const runs = steps
    .map((step) => step.run)
    .filter((run) => typeof run === 'string')
    .join('\n');

  // The renderer is one CI step by design, so the local command and the
  // workflow cannot drift. Asserting the eight commands it replaced would put
  // that drift back; the gate list below is what proves they still run.
  for (const command of ['pnpm test:toolchain', 'pnpm check:web', 'pnpm test:package-inputs']) {
    assert.match(runs, new RegExp(command.replaceAll(':', '\\:')), `source CI omits ${command}`);
  }

  const stepIndex = (name) => steps.findIndex((step) => step.name === name);
  assert.ok(
    stepIndex('Install dependencies') < stepIndex('Verify Vite+ inventory') &&
      stepIndex('Verify Vite+ inventory') < stepIndex('Check supported renderer') &&
      stepIndex('Check supported renderer') < stepIndex('Test renderer packaging input') &&
      stepIndex('Test renderer packaging input') < stepIndex('Install Python sidecar dependencies'),
    'source CI must fail replacement gates before entering the broader application matrix',
  );
});

test('the one renderer CI step still covers every replacement check', () => {
  // `pnpm check:web` collapsed eight separate CI steps into one runner. This is
  // what stops the collapse from quietly losing a gate: every command CI used
  // to name has to still be reachable from the runner's own list.
  const named = new Set(gates.flatMap((gate) => gate.args));
  for (const script of [
    'test:renderer-architecture',
    'check:renderer-size',
    'check:renderer-conventions',
    'check:renderer-unused',
    'check:renderer-dupes',
    'format:web',
    'lint:web',
    // The renderer suite runs under the coverage gate rather than as
    // `test:renderer`, which is the same suite plus its floor.
    'test:renderer:coverage',
    'typecheck:web',
    'build:web',
    'build:storybook',
  ]) {
    assert.ok(named.has(script), `pnpm check:web no longer runs ${script}`);
  }
});

test('Vite+ task-result caching is disabled repository-wide', () => {
  const config = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  assert.match(config, /run:\s*{[\s\S]*?cache:\s*false/);
});

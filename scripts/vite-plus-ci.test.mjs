import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const setupAction = 'voidzero-dev/setup-vp@1b32467adbe183473499fd9d5d372c3ed9641754';
const rendererJobs = new Map([
  ['.github/workflows/ci.yml', ['source-build', 'ui-smoke', 'ui-regression']],
  ['.github/workflows/visual-baselines.yml', ['generate-linux-baselines']],
  ['.github/workflows/release-macos.yml', ['macos-dmg']],
  ['.github/workflows/release-linux.yml', ['linux-packages']],
  ['.github/workflows/release-windows.yml', ['windows-installer']],
]);

function readWorkflow(relativePath) {
  return parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('every CI and release renderer build uses the same pinned Vite+ setup', () => {
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

test('source CI runs replacement checks before the broader application matrix', () => {
  const workflow = readWorkflow('.github/workflows/ci.yml');
  const steps = workflow.jobs?.['source-build']?.steps ?? [];
  const runs = steps
    .map((step) => step.run)
    .filter((run) => typeof run === 'string')
    .join('\n');

  for (const command of [
    'pnpm test:toolchain',
    'pnpm test:renderer-architecture',
    'pnpm format:web',
    'pnpm lint:web',
    'pnpm test:renderer',
    'pnpm typecheck:web',
    'pnpm build:web',
    'pnpm test:package-inputs',
  ]) {
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

test('Vite+ task-result caching is disabled repository-wide', () => {
  const config = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  assert.match(config, /run:\s*{[\s\S]*?cache:\s*false/);
});

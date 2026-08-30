import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { findRendererArchitectureViolations } from './check-renderer-architecture.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dependencyCruiserBin = path.join(
  repositoryRoot,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruise.mjs',
);
const oxlintBin = path.join(repositoryRoot, 'node_modules', 'oxlint', 'bin', 'oxlint');
const dependencyCruiserConfig = path.join(repositoryRoot, 'dependency-cruiser.config.cjs');
const oxlintConfig = path.join(repositoryRoot, '.oxlintrc.json');
const architectureDeclaration = {
  features: [
    { name: 'agent', productArea: 'Agent Panel' },
    { name: 'documents', productArea: 'Documents' },
    { name: 'preparation', productArea: 'Preparation' },
    { name: 'retrieval', productArea: 'Search and Retrieval' },
    { name: 'settings', productArea: 'Workspace / Agent Panel' },
    { name: 'workspace', productArea: 'Workspace' },
  ],
  wireSchemaModules: [],
};

function write(root, relativePath, source) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, source);
}

function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-renderer-architecture-'));
  context.after(() => fs.rmSync(root, { recursive: true }));
  write(
    root,
    'renderer/renderer-architecture.json',
    `${JSON.stringify(architectureDeclaration, null, 2)}\n`,
  );
  write(
    root,
    'renderer-architecture.tsconfig.json',
    `${JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        module: 'ESNext',
        moduleResolution: 'bundler',
        paths: { '@/*': ['renderer/src/*'] },
      },
      include: ['renderer/src'],
    })}\n`,
  );
  return root;
}

function runNodeTool(bin, arguments_, cwd) {
  const result = spawnSync(process.execPath, [bin, ...arguments_], {
    cwd,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

test('the approved empty renderer architecture passes the repository checker', (context) => {
  const root = fixture(context);
  write(root, 'renderer/src/main.ts', "import './app';\n");
  write(root, 'renderer/src/app.ts', 'export const app = true;\n');

  assert.deepEqual(findRendererArchitectureViolations(root), []);
});

test('the repository checker rejects legacy access and undeclared feature structure', (context) => {
  const root = fixture(context);
  write(root, 'renderer/src/main.ts', "import '../../web-src/src/app';\n");
  write(root, 'renderer/src/features/unknown/helpers.ts', 'export const value = true;\n');

  assert.deepEqual(findRendererArchitectureViolations(root), [
    'renderer/src/features/unknown has no feature ownership declaration',
    'renderer/src/features/unknown/helpers.ts is not an approved feature layer',
    'renderer/src/features/unknown/public.ts is required for an implemented feature',
    'renderer/src/main.ts references forbidden implementation path web-src',
  ]);
});

test('repository wire imports must use a registered executable-schema module', (context) => {
  const root = fixture(context);
  write(root, 'shared/workspace-protocol.ts', 'export const schema = {};\n');
  write(
    root,
    'renderer/src/app.ts',
    "import { schema } from '../../shared/workspace-protocol';\nexport { schema };\n",
  );

  assert.deepEqual(findRendererArchitectureViolations(root), [
    'renderer/src/app.ts imports an unregistered repository wire module ../../shared/workspace-protocol',
  ]);

  const registered = structuredClone(architectureDeclaration);
  registered.wireSchemaModules = ['shared/workspace-protocol.ts'];
  write(root, 'renderer/renderer-architecture.json', `${JSON.stringify(registered, null, 2)}\n`);
  assert.deepEqual(findRendererArchitectureViolations(root), []);
});

test('dependency-cruiser accepts inward dependencies inside one feature', (context) => {
  const root = fixture(context);
  write(root, 'renderer/src/features/workspace/domain/model.ts', 'export const model = true;\n');
  write(
    root,
    'renderer/src/features/workspace/application/read-model.ts',
    "import { model } from '../domain/model';\nexport { model };\n",
  );
  write(
    root,
    'renderer/src/features/workspace/public.ts',
    "export { model } from './application/read-model';\n",
  );

  const result = runNodeTool(
    dependencyCruiserBin,
    ['--config', dependencyCruiserConfig, 'renderer/src'],
    root,
  );
  assert.equal(result.status, 0, result.output);
});

test('dependency-cruiser rejects cycles, sibling access, deep imports, and layer inversion', (context) => {
  const root = fixture(context);
  write(root, 'renderer/src/shared/utilities/first.ts', "import './second';\n");
  write(root, 'renderer/src/shared/utilities/second.ts', "import './first';\n");
  write(root, 'renderer/src/features/documents/domain/model.ts', 'export const document = true;\n');
  write(
    root,
    'renderer/src/features/documents/public.ts',
    "export { document } from './domain/model';\n",
  );
  write(
    root,
    'renderer/src/features/workspace/application/runtime.ts',
    "import { document } from '../../documents/public';\nexport { document };\n",
  );
  write(
    root,
    'renderer/src/features/workspace/domain/model.ts',
    "import { document } from '../application/runtime';\nexport { document };\n",
  );
  write(root, 'renderer/src/features/workspace/public.ts', 'export const workspace = true;\n');
  write(
    root,
    'renderer/src/app/composition/compose.ts',
    "import { document } from '../../features/documents/domain/model';\nexport { document };\n",
  );
  write(
    root,
    'renderer/src/main.ts',
    "import { document } from './features/documents/public';\nexport { document };\n",
  );
  write(root, 'renderer/src/platform/api/client.ts', 'export const client = true;\n');
  write(
    root,
    'renderer/src/features/workspace/ui/view.ts',
    "import { client } from '../../../platform/api/client';\nexport { client };\n",
  );

  const result = runNodeTool(
    dependencyCruiserBin,
    ['--config', dependencyCruiserConfig, 'renderer/src'],
    root,
  );
  assert.notEqual(result.status, 0, result.output);
  for (const rule of [
    'no-circular',
    'no-sibling-feature-imports',
    'feature-public-entry-only',
    'feature-public-only-from-app',
    'domain-is-pure',
    'ui-has-no-platform-access',
  ]) {
    assert.match(result.output, new RegExp(rule), `missing ${rule}:\n${result.output}`);
  }
});

test('Oxlint rejects platform APIs in domain, application, and UI layers', (context) => {
  const root = fixture(context);
  write(
    root,
    'renderer/src/features/workspace/domain/unsafe-domain.ts',
    "import React from 'react';\nexport const request = fetch('/api');\nexport { React };\n",
  );
  write(
    root,
    'renderer/src/features/workspace/application/unsafe-command.ts',
    "export const socket = new WebSocket('ws://localhost');\n",
  );
  write(
    root,
    'renderer/src/features/workspace/ui/unsafe-view.ts',
    'export const bridge = window.stashbase;\n',
  );

  const result = runNodeTool(
    oxlintBin,
    [
      '--config',
      oxlintConfig,
      'renderer/src/features/workspace/domain/unsafe-domain.ts',
      'renderer/src/features/workspace/application/unsafe-command.ts',
      'renderer/src/features/workspace/ui/unsafe-view.ts',
    ],
    root,
  );
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /Domain modules are pure/);
  assert.match(result.output, /Application code consumes injected ports/);
  assert.match(result.output, /Use an injected platform adapter/);
});

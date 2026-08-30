import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeToolchain, verifyToolchain } from './check-vite-plus-toolchain.mjs';

test('normalization removes only the machine-specific local package path', () => {
  const inventory = {
    schemaVersion: 1,
    source: { scope: 'local', path: '/machine/node_modules/vite-plus', vitePlusVersion: '1.2.3' },
    nodes: [{ id: 'vite', version: '4.5.6' }],
    edges: [{ from: 'vite-plus', to: 'vite', relationship: 'bundles' }],
  };

  assert.deepEqual(normalizeToolchain(inventory), {
    schemaVersion: 1,
    source: { scope: 'local', vitePlusVersion: '1.2.3' },
    nodes: inventory.nodes,
    edges: inventory.edges,
  });
  assert.equal(inventory.source.path, '/machine/node_modules/vite-plus');
});

test('the repository-local Vite+ inventory matches the committed record', () => {
  assert.doesNotThrow(() => verifyToolchain());
});

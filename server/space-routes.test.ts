import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('space-routes-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

test('clearCurrentSpace closes only the active window space', async () => {
  const kbRoot = tmpDir('space-routes-kb');
  fs.mkdirSync(path.join(kbRoot, 'Alpha'), { recursive: true });
  fs.mkdirSync(path.join(kbRoot, 'Beta'), { recursive: true });

  const {
    clearCurrentSpace,
    getCurrentSpace,
    runWithWindowId,
    setCurrentSpace,
    setKbRoot,
  } = await import('./space.ts');

  await setKbRoot(kbRoot, { allowNonEmpty: true });

  runWithWindowId('win-a', () => setCurrentSpace(path.join(kbRoot, 'Alpha')));
  runWithWindowId('win-b', () => setCurrentSpace(path.join(kbRoot, 'Beta')));

  runWithWindowId('win-a', () => clearCurrentSpace());

  assert.equal(runWithWindowId('win-a', () => getCurrentSpace()), null);
  assert.equal(runWithWindowId('win-b', () => path.basename(getCurrentSpace() ?? '')), 'Beta');
});

test('space references map explicit non-current space hits without reading window state', async () => {
  const kbRoot = tmpDir('space-routes-explicit-kb');
  fs.mkdirSync(path.join(kbRoot, 'Alpha'), { recursive: true });
  fs.mkdirSync(path.join(kbRoot, 'Beta'), { recursive: true });

  const {
    fromKbRelForSpace,
    getCurrentSpaceName,
    requireSpaceExistsByName,
    runWithWindowId,
    setCurrentSpace,
    setKbRoot,
    validateSpaceRef,
  } = await import('./space.ts');

  await setKbRoot(kbRoot, { allowNonEmpty: true });

  assert.equal(validateSpaceRef('Beta'), null);
  assert.equal(requireSpaceExistsByName('Beta'), path.join(kbRoot, 'Beta'));

  runWithWindowId('explicit-win', () => setCurrentSpace(path.join(kbRoot, 'Alpha')));
  assert.equal(runWithWindowId('explicit-win', () => getCurrentSpaceName()), 'Alpha');
  assert.equal(fromKbRelForSpace('Beta/docs/note.md', 'Beta'), 'docs/note.md');
  assert.equal(fromKbRelForSpace('Alpha/docs/note.md', 'Beta'), null);
});

test('space references reject escaping, nested, or unnormalized names', async () => {
  const { validateSpaceRef } = await import('./space.ts');

  assert.equal(validateSpaceRef('../Alpha'), 'name cannot start with "."');
  assert.equal(validateSpaceRef('Alpha//Beta'), 'name cannot contain slashes');
  assert.equal(validateSpaceRef('/Alpha'), 'name cannot contain slashes');
  assert.equal(validateSpaceRef('Alpha\\Beta'), 'name cannot contain slashes');
});

test('space config rename replaces stale destination config', async () => {
  const kbRoot = tmpDir('space-routes-config-rename-kb');
  fs.mkdirSync(path.join(kbRoot, 'Alpha'), { recursive: true });
  const {
    readSpaceConfig,
    renameSpaceConfig,
    setKbRoot,
    writeSpaceConfig,
  } = await import('./space.ts');

  await setKbRoot(kbRoot, { allowNonEmpty: true });
  writeSpaceConfig('Alpha', { mcpServers: { alpha: { command: '/bin/echo', args: ['alpha'] } } });
  writeSpaceConfig('Beta', { mcpServers: { stale: { command: '/bin/echo', args: ['stale'] } } });

  renameSpaceConfig('Alpha', 'Beta');

  assert.deepEqual(readSpaceConfig('Alpha'), {});
  assert.deepEqual(readSpaceConfig('Beta'), {
    mcpServers: { alpha: { command: '/bin/echo', args: ['alpha'] } },
  });
});

test('space config delete prevents same-name recreated spaces inheriting stale config', async () => {
  const kbRoot = tmpDir('space-routes-config-delete-kb');
  fs.mkdirSync(path.join(kbRoot, 'Alpha'), { recursive: true });
  const {
    deleteSpaceConfig,
    getSpaceConfigPath,
    readSpaceConfig,
    setKbRoot,
    writeSpaceConfig,
  } = await import('./space.ts');

  await setKbRoot(kbRoot, { allowNonEmpty: true });
  writeSpaceConfig('Alpha', { mcpServers: { alpha: { command: '/bin/echo' } } });
  const file = getSpaceConfigPath('Alpha');

  deleteSpaceConfig('Alpha');

  assert.equal(fs.existsSync(file), false);
  assert.deepEqual(readSpaceConfig('Alpha'), {});
});

test('asset window context can come from reserved path prefix or query string', async () => {
  const kbRoot = tmpDir('space-routes-window-asset-kb');
  fs.mkdirSync(path.join(kbRoot, 'Alpha'), { recursive: true });
  fs.mkdirSync(path.join(kbRoot, 'Beta'), { recursive: true });

  const {
    getCurrentSpaceName,
    runWithWindowId,
    setCurrentSpace,
    setKbRoot,
  } = await import('./space.ts');
  const { withWindowContext } = await import('./http.ts');

  await setKbRoot(kbRoot, { allowNonEmpty: true });
  runWithWindowId('asset-a', () => setCurrentSpace(path.join(kbRoot, 'Alpha')));
  runWithWindowId('asset-b', () => setCurrentSpace(path.join(kbRoot, 'Beta')));

  const resolveViaMiddleware = (req: { path: string; query?: Record<string, string>; header?: (name: string) => string | undefined }) => {
    let resolved: string | null = null;
    withWindowContext(
      { query: {}, header: () => undefined, ...req } as any,
      {} as any,
      () => { resolved = getCurrentSpaceName(); },
    );
    return resolved;
  };

  assert.equal(resolveViaMiddleware({ path: '/asset/__window/asset-a/docs/note.md' }), 'Alpha');
  assert.equal(resolveViaMiddleware({ path: '/asset/docs/note.md', query: { windowId: 'asset-b' } }), 'Beta');
});

test('space operations reject while a conversion is in flight under that space', async () => {
  const { markInFlight, clearRecord } = await import('./conversion-status.ts');
  const { assertNoInFlightSpaceConversion } = await import('./routes/space.ts');

  markInFlight('Busy/docs/paper.pdf');
  try {
    assert.throws(
      () => assertNoInFlightSpaceConversion('Busy'),
      (err: unknown) => (
        err instanceof Error &&
        err.message === 'space has conversions in progress' &&
        (err as { status?: unknown }).status === 409 &&
        (err as { code?: unknown }).code === 'CONVERSION_IN_FLIGHT'
      ),
    );
    assert.doesNotThrow(() => assertNoInFlightSpaceConversion('Other'));
  } finally {
    clearRecord('Busy/docs/paper.pdf');
  }
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('kb-routes-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

async function openKbRoot(label: string): Promise<void> {
  const { setKbRoot } = await import('./space.ts');
  const kbRoot = tmpDir(`${label}-kb`);
  fs.mkdirSync(path.join(kbRoot, 'Project'), { recursive: true });
  await setKbRoot(kbRoot, { allowNonEmpty: true });
}

test('normalizeKbSearchScope validates explicit space and kb-relative prefix', async () => {
  await openKbRoot('kb-search-scope');
  const { normalizeKbSearchScope } = await import('./routes/kb.ts');

  assert.deepEqual(
    normalizeKbSearchScope('Project', 'Project/docs'),
    { space: 'Project', pathPrefix: 'Project/docs' },
  );
  assert.deepEqual(
    normalizeKbSearchScope(undefined, 'Project/docs/'),
    { space: undefined, pathPrefix: 'Project/docs' },
  );
});

test('normalizeKbSearchScope rejects missing spaces and escaping prefixes', async () => {
  await openKbRoot('kb-search-invalid');
  const { normalizeKbSearchScope } = await import('./routes/kb.ts');

  assert.throws(
    () => normalizeKbSearchScope('Missing', undefined),
    /space not found/,
  );
  assert.throws(
    () => normalizeKbSearchScope(undefined, 'Missing/docs'),
    /space not found/,
  );
  assert.throws(
    () => normalizeKbSearchScope(undefined, '../Project'),
    /invalid segment/,
  );
  assert.throws(
    () => normalizeKbSearchScope(undefined, '/Project'),
    /kbRoot-relative POSIX path/,
  );
});

test('requireKbStatusSpace validates explicit status spaces', async () => {
  await openKbRoot('kb-status-space');
  const { requireKbStatusSpace } = await import('./routes/kb.ts');

  assert.equal(requireKbStatusSpace('Project'), 'Project');
  assert.equal(requireKbStatusSpace(undefined), undefined);
  assert.throws(
    () => requireKbStatusSpace('Missing'),
    /space not found/,
  );
});

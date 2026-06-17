import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('kb-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

async function openKbRoot(label: string): Promise<string> {
  const { setKbRoot, getKbRoot } = await import('./space.ts');
  const kbRoot = tmpDir(`${label}-root`);
  await setKbRoot(kbRoot, { allowNonEmpty: true });
  return getKbRoot();
}

test('setKbRules atomically replaces the KB-level rules file', async () => {
  const kbRoot = await openKbRoot('rules-write');
  const { getKbRules, setKbRules } = await import('./kb.ts');

  setKbRules('# Rules\n\nBe concise.\n');

  assert.equal(getKbRules(), '# Rules\n\nBe concise.\n');
  assert.equal(fs.readFileSync(path.join(kbRoot, 'STASHBASE.md'), 'utf8'), '# Rules\n\nBe concise.\n');
  assert.deepEqual(
    fs.readdirSync(kbRoot).filter((name) => name.includes('STASHBASE.md') && name.endsWith('.tmp')),
    [],
  );
});

test('setKbRules rejects stale versions instead of overwriting newer rules', async () => {
  await openKbRoot('rules-stale-write');
  const { getKbRules, kbRulesVersion, setKbRules } = await import('./kb.ts');

  const first = setKbRules('# Rules\n\nFirst.\n');
  setKbRules('# Rules\n\nNewer.\n', { baseVersion: first ?? undefined });

  assert.throws(
    () => setKbRules('# Rules\n\nOld tab.\n', { baseVersion: first ?? undefined }),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, 'FILE_CHANGED');
      return true;
    },
  );
  assert.equal(getKbRules(), '# Rules\n\nNewer.\n');
  assert.notEqual(kbRulesVersion(), first);
});

test('setKbRules detects same-size external edits that preserve mtime', async () => {
  const kbRoot = await openKbRoot('rules-same-size-write');
  const { getKbRules, setKbRules } = await import('./kb.ts');

  const first = setKbRules('aaaa\n');
  const file = path.join(kbRoot, 'STASHBASE.md');
  const before = fs.statSync(file);
  fs.writeFileSync(file, 'bbbb\n');
  fs.utimesSync(file, before.atime, before.mtime);

  assert.throws(
    () => setKbRules('cccc\n', { baseVersion: first ?? undefined }),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, 'FILE_CHANGED');
      return true;
    },
  );
  assert.equal(getKbRules(), 'bbbb\n');
});

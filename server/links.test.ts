import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('links-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

const space = await import('./space.ts');
const files = await import('./files.ts');
const links = await import('./links.ts');

async function openTestSpace(label: string): Promise<void> {
  const kbRoot = tmpDir(`${label}-kb`);
  const spaceRoot = path.join(kbRoot, 'Project');
  fs.mkdirSync(spaceRoot, { recursive: true });
  await space.setKbRoot(kbRoot, { allowNonEmpty: true });
  space.setCurrentSpace(spaceRoot);
}

test('applied rename plans can roll back link rewrites after later failures', async () => {
  await openTestSpace('rename-plan-rollback');
  files.saveText('old.md', '# Old\n');
  files.saveText('ref.md', '[Old](old.md)\n');

  const plan = links.planRenameLinks([{ kind: 'file', old: 'old.md', new: 'new.md' }]);
  assert.equal(plan.length, 1);

  files.renameOnDisk('old.md', 'new.md');
  const applied = links.applyRenamePlan(plan);

  assert.equal(applied.failed.length, 0);
  assert.equal(files.readText('ref.md'), '[Old](new.md)\n');

  applied.rollback();

  assert.equal(files.readText('ref.md'), '[Old](old.md)\n');
});

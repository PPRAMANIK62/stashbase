import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { ConversionSpec } from './conversion.ts';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('conversion-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

const space = await import('./space.ts');
const conversion = await import('./conversion.ts');
const status = await import('./conversion-status.ts');

async function openTestSpace(label: string): Promise<{ kbRoot: string; spaceRoot: string; spaceName: string }> {
  const kbRoot = tmpDir(`${label}-kb`);
  const spaceName = 'Project';
  const spaceRoot = path.join(kbRoot, spaceName);
  fs.mkdirSync(spaceRoot, { recursive: true });
  await space.setKbRoot(kbRoot, { allowNonEmpty: true });
  space.setCurrentSpace(spaceRoot);
  return { kbRoot, spaceRoot, spaceName };
}

function derivedNote(absPath: string): string {
  return path.join(path.dirname(absPath), `.${path.basename(absPath)}.md`);
}

function testSpec(overrides: Partial<ConversionSpec> = {}): ConversionSpec {
  return {
    kind: 'test_extract',
    matches: (name) => /\.pdf$/i.test(name),
    derivedNote,
    convert: async (absPath) => {
      fs.writeFileSync(derivedNote(absPath), '# extracted\n');
    },
    cleanupDerived: (absPath) => {
      fs.rmSync(derivedNote(absPath), { force: true });
    },
    ...overrides,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('maybeConvert clears stale failure when derived note already exists', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-derived-present');
  const source = path.join(spaceRoot, 'paper.pdf');
  const kbRel = `${spaceName}/paper.pdf`;
  fs.writeFileSync(source, '%PDF-1.7\n');
  fs.writeFileSync(derivedNote(source), '# extracted\n');
  status.markFailed(kbRel, 'old failure');

  conversion.maybeConvert(source, testSpec());

  assert.equal(status.readAll()[kbRel], undefined);
  assert.equal(status.listInFlight().includes(kbRel), false);
});

test('maybeConvert does not start a duplicate conversion while one is in flight', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-duplicate-inflight');
  const source = path.join(spaceRoot, 'paper.pdf');
  const kbRel = `${spaceName}/paper.pdf`;
  fs.writeFileSync(source, '%PDF-1.7\n');
  let calls = 0;
  let finish!: () => void;

  conversion.maybeConvert(source, testSpec({
    convert: async (absPath) => {
      calls += 1;
      await new Promise<void>((resolve) => { finish = resolve; });
      fs.writeFileSync(derivedNote(absPath), '# extracted\n');
    },
  }));
  conversion.maybeConvert(source, testSpec({
    convert: async () => {
      calls += 1;
    },
  }));

  assert.equal(calls, 1);
  assert.equal(status.listInFlight().includes(kbRel), true);
  finish();
  await wait(900);
  assert.equal(status.listInFlight().includes(kbRel), false);
});

test('maybeConvert leaves persisted failures for explicit retry', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-failure-retry-gate');
  const source = path.join(spaceRoot, 'paper.pdf');
  const kbRel = `${spaceName}/paper.pdf`;
  fs.writeFileSync(source, '%PDF-1.7\n');
  status.markFailed(kbRel, 'old failure');
  let calls = 0;

  conversion.maybeConvert(source, testSpec({
    convert: async () => {
      calls += 1;
    },
  }));

  assert.equal(calls, 0);
  assert.equal(status.readAll()[kbRel]?.status, 'failed');
});

test('conversion success cleans derived output when source was deleted mid-run', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-source-deleted-success');
  const source = path.join(spaceRoot, 'paper.pdf');
  const kbRel = `${spaceName}/paper.pdf`;
  fs.writeFileSync(source, '%PDF-1.7\n');

  conversion.maybeConvert(source, testSpec({
    convert: async (absPath) => {
      fs.rmSync(absPath, { force: true });
      fs.writeFileSync(derivedNote(absPath), '# extracted after delete\n');
    },
  }));
  await wait(900);

  assert.equal(fs.existsSync(source), false);
  assert.equal(fs.existsSync(derivedNote(source)), false);
  assert.equal(status.readAll()[kbRel], undefined);
  assert.equal(status.listInFlight().includes(kbRel), false);
});

test('conversion failure clears status when source was deleted mid-run', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-source-deleted-failure');
  const source = path.join(spaceRoot, 'paper.pdf');
  const kbRel = `${spaceName}/paper.pdf`;
  fs.writeFileSync(source, '%PDF-1.7\n');

  conversion.maybeConvert(source, testSpec({
    convert: async (absPath) => {
      fs.rmSync(absPath, { force: true });
      throw new Error('source disappeared');
    },
  }));
  await wait(900);

  assert.equal(fs.existsSync(source), false);
  assert.equal(status.readAll()[kbRel], undefined);
  assert.equal(status.listInFlight().includes(kbRel), false);
});

test('conversion success cleans stale derived output when source changed mid-run', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-source-changed-success');
  const source = path.join(spaceRoot, 'paper.pdf');
  const kbRel = `${spaceName}/paper.pdf`;
  fs.writeFileSync(source, '%PDF old\n');

  conversion.maybeConvert(source, testSpec({
    convert: async (absPath) => {
      await wait(5);
      fs.writeFileSync(absPath, '%PDF new\n');
      fs.writeFileSync(derivedNote(absPath), '# extracted old content\n');
    },
  }));
  await wait(900);

  assert.equal(fs.readFileSync(source, 'utf8'), '%PDF new\n');
  assert.equal(fs.existsSync(derivedNote(source)), false);
  assert.equal(status.readAll()[kbRel], undefined);
  assert.equal(status.listInFlight().includes(kbRel), false);
});

test('conversion failure does not persist failure for a changed source', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-source-changed-failure');
  const source = path.join(spaceRoot, 'paper.pdf');
  const kbRel = `${spaceName}/paper.pdf`;
  fs.writeFileSync(source, '%PDF old\n');

  conversion.maybeConvert(source, testSpec({
    convert: async (absPath) => {
      await wait(5);
      fs.writeFileSync(absPath, '%PDF new\n');
      throw new Error('extract failed for old source');
    },
  }));
  await wait(900);

  assert.equal(fs.readFileSync(source, 'utf8'), '%PDF new\n');
  assert.equal(status.readAll()[kbRel], undefined);
  assert.equal(status.listInFlight().includes(kbRel), false);
});

test('discoverNewSources skips iCloud placeholder directories', async () => {
  const { spaceRoot, spaceName } = await openTestSpace('conversion-icloud-placeholder');
  const cloudDir = path.join(spaceRoot, 'Remote.icloud');
  const source = path.join(cloudDir, 'paper.pdf');
  fs.mkdirSync(cloudDir);
  fs.writeFileSync(source, '%PDF-1.7\n');
  let calls = 0;

  conversion.discoverNewSources(spaceRoot, testSpec({
    convert: async () => {
      calls += 1;
    },
  }));

  assert.equal(calls, 0);
  assert.equal(status.readAll()[`${spaceName}/Remote.icloud/paper.pdf`], undefined);
});

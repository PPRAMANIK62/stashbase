import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const actionPath = '.github/actions/prepare-native-components/action.yml';
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const steps = parse(read(actionPath)).runs.steps;
const restore = (id) => steps.find((step) => step.id === id);

// Evaluate the file inputs in the actual workflow key, then mutate one input.
// This catches stale component reuse when runtime/build inputs change without
// coupling the test to one literal cache key or application version.
function fingerprint(id, overrides = {}) {
  const expression = restore(id).with.key.match(/hashFiles\((.*?)\)/)[1];
  const patterns = [...expression.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const files = [...new Set(patterns.flatMap((pattern) => [...fs.globSync(pattern, { cwd: root })]
    .map((file) => file.replaceAll('\\', '/'))))].sort();
  const digest = createHash('sha256');
  for (const file of files) digest.update(file).update(overrides[file] ?? read(file));
  return digest.digest('hex');
}

test('native reuse invalidates on source/build changes but survives an app version bump', () => {
  for (const [id, files] of [
    ['python-cache', ['python/stashbase_daemon.py', 'python/extract_main.py', 'python/constraints.txt', 'scripts/build-python-sidecar.mjs', 'scripts/setup-python.mjs']],
    ['transcription-cache', ['native/transcription/toolchain.json', 'scripts/build-transcription-sidecar.sh', 'scripts/check-transcription-media.mjs']],
  ]) {
    const original = fingerprint(id);
    for (const file of [...files, actionPath]) {
      assert.notEqual(fingerprint(id, { [file]: `${read(file)}\nchanged` }), original, `${id}: ${file}`);
    }
    assert.equal(fingerprint(id, { 'package.json': '{"version":"999.0.0"}' }), original);
    const cache = restore(id);
    assert.equal(cache.with['restore-keys'], undefined, 'native binaries require an exact input match');
    assert.match(cache.with.key, /runner.os/);
    assert.match(cache.with.key, /runner.arch/);
    assert.match(cache.with.key, /steps.image.outputs.id/);
    const builder = steps.filter((step) => step.name?.startsWith('Build ') && step.if?.includes(id));
    assert.ok(builder.length > 0);
    for (const step of builder) assert.match(step.if, new RegExp(`${id}\\.outputs\\.cache-hit != 'true'`));
  }
});

test('shared caches are populated on main before signing and reused by every release platform', () => {
  const warm = parse(read('.github/workflows/native-components.yml'));
  assert.deepEqual(warm.on.push.branches, ['main']);
  assert.equal(warm.jobs.prepare.if, "github.ref == 'refs/heads/main'");
  for (const step of steps.filter((step) => step.uses?.startsWith('actions/cache/save@'))) {
    assert.match(step.if, /github.ref == 'refs\/heads\/main'/);
    assert.match(step.if, /cache-hit != 'true'/);
  }
  assert.ok(steps.every((step) => !/sign-extractor|build:extractor-component|package-desktop/.test(step.run ?? '')));
  for (const [platform, job] of [['macos', 'macos-dmg'], ['linux', 'linux-packages'], ['windows', 'windows-installer']]) {
    const release = parse(read(`.github/workflows/release-${platform}.yml`)).jobs[job];
    assert.ok(warm.jobs.prepare.strategy.matrix.os.includes(release['runs-on']));
    const prepareIndex = release.steps.findIndex((step) => step.uses === './.github/actions/prepare-native-components');
    const componentIndex = release.steps.findIndex((step) => step.run === 'pnpm build:extractor-component');
    const packageIndex = release.steps.findIndex((step) => step.env?.STASHBASE_SKIP_SIDECAR_BUILD === '1');
    assert.ok(prepareIndex >= 0 && componentIndex > prepareIndex && packageIndex > componentIndex);
    assert.equal(release.steps[packageIndex].env.STASHBASE_SKIP_TRANSCRIPTION_BUILD, '1');
    assert.equal(release.steps.some((step) => step.uses?.startsWith('msys2/')), false);
  }
});

test('a stale Python dependency resolution fails before installation or cache restore', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-lock-test-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  fs.mkdirSync(path.join(scratch, 'python'));
  for (const file of ['requirements.txt', 'requirements-extract.txt', 'build-requirements.txt', 'constraints.txt']) {
    fs.copyFileSync(path.join(root, 'python', file), path.join(scratch, 'python', file));
  }
  const check = () => spawnSync(process.execPath, [path.join(root, 'scripts/lock-python.mjs'), '--check'], { cwd: scratch, encoding: 'utf8' });
  assert.equal(check().status, 0);
  fs.appendFileSync(path.join(scratch, 'python/requirements.txt'), '\nunreviewed-dependency>=1\n');
  const result = check();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Run pnpm lock:python/);
  assert.ok(steps.findIndex((step) => step.run === 'node scripts/lock-python.mjs --check') < steps.indexOf(restore('python-cache')));
});

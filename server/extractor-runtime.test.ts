import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as tar from 'tar';
import { createExtractorRuntime, unpackExtractor } from './extractor-runtime.ts';
import { extractorAssetName } from '../shared/extractor-runtime.ts';

async function fixture(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'extractor-install-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  await fs.mkdir(path.join(source, 'stashbase-extract'), { recursive: true });
  await fs.writeFile(path.join(source, 'stashbase-extract', 'stashbase-extract'), '#!/bin/sh\nexit 0\n');
  const archive = path.join(root, 'fixture.tar.gz');
  await tar.c({ file: archive, cwd: source, gzip: true }, ['stashbase-extract']);
  const bytes = await fs.readFile(archive);
  const manifest = {
    schema: 1, version: '1.2.3', platform: 'darwin', arch: 'arm64',
    asset: extractorAssetName('1.2.3', 'darwin', 'arm64'),
    sizeBytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
  const options = { root: path.join(root, 'installed'), platform: 'darwin' as const, arch: 'arm64', manifest: async () => manifest,  };
  const runtimes: ReturnType<typeof createExtractorRuntime>[] = [];
  t.after(async () => { for (const runtime of runtimes) await runtime.close(); });
  const make = (extra: Partial<Parameters<typeof createExtractorRuntime>[0]> = {}) => {
    const runtime = createExtractorRuntime({ ...options, ...extra }); runtimes.push(runtime); return runtime;
  };
  return { root, source, archive, bytes, manifest, options, make };
}

async function until(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!await check()) {
    if (Date.now() > deadline) assert.fail('condition did not settle');
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('older Intel Macs reject only extraction without download, retry, or durable demand', async (t) => {
  const f = await fixture(t);
  const runtime = f.make({ arch: 'x64', osRelease: '21.6.0', fetch: async () => {
    assert.fail('unsupported components must never download');
  } });
  const unavailable = { status: 'failed', error: 'unsupported-system' };
  assert.deepEqual(await runtime.status(), unavailable);
  await runtime.resume();
  assert.deepEqual(await runtime.retry(), unavailable);
  await assert.rejects(runtime.ensure(), /macOS 15.*Intel Macs/);
  assert.equal(runtime.current(), undefined);
  assert.equal(await fs.access(f.options.root).then(() => true, () => false), false);
});

test('supported Intel Macs install their own component and reuse it offline', async (t) => {
  const f = await fixture(t);
  const manifest = { ...f.manifest, arch: 'x64', asset: extractorAssetName('1.2.3', 'darwin', 'x64') };
  const options = { arch: 'x64', osRelease: '24.0.0', manifest: async () => manifest };
  const runtime = f.make({ ...options, fetch: async () => new Response(f.bytes) });
  const executable = await runtime.ensure();
  const offline = f.make({ ...options, fetch: async () => { assert.fail('installed component must stay offline'); } });
  assert.equal(await offline.ensure(), executable);
});

test('status and fresh startup are read-only; concurrent first demand installs once and reopens offline', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const runtime = f.make({ fetch: async () => { calls++; return new Response(f.bytes); } });
  assert.equal((await runtime.status()).status, 'not-installed');
  await runtime.resume(); assert.equal(calls, 0);
  const paths = await Promise.all([runtime.ensure(), runtime.ensure(), runtime.ensure()]);
  assert.equal(new Set(paths).size, 1); assert.equal(calls, 1);
  assert.equal((await runtime.status()).status, 'installed');
  const offline = f.make({ fetch: async () => { assert.fail('installed component must stay offline'); } });
  await offline.resume();
  assert.equal(await offline.ensure(), paths[0]);
  assert.deepEqual(await fs.readdir(f.options.root), [f.manifest.sha256]);
});

test('failed demand stays pending without timer retries; explicit Retry resumes all waiting tasks', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const runtime = f.make({ fetch: async () => { calls++; if (calls === 1) throw new Error('offline'); return new Response(f.bytes); } });
  let settled = false;
  const first = runtime.ensure().then((bin) => { settled = true; return bin; });
  await until(async () => (await runtime.status()).status === 'failed');
  const second = runtime.ensure();
  await runtime.resume(); await runtime.status();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(calls, 1); assert.equal(settled, false);
  assert.equal((await runtime.status()).error, 'network');
  await Promise.all([runtime.retry(), runtime.retry()]);
  assert.equal(await first, await second); assert.equal(calls, 2);
});

test('an unfinished download gets one startup attempt per process and survives another failure', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const offline = async () => { calls++; throw new Error('offline'); };
  const first = f.make({ fetch: offline });
  const waiting = assert.rejects(first.ensure(), /closed/);
  await until(async () => (await first.status()).status === 'failed');
  await first.close(); await waiting;
  const second = f.make({ fetch: offline });
  await second.resume();
  await until(async () => (await second.status()).status === 'failed');
  await Promise.all([second.resume(), second.resume()]); assert.equal(calls, 2);
  await second.close();
  const third = f.make({ fetch: async () => { calls++; return new Response(f.bytes); } });
  await third.resume();
  assert.ok(await third.ensure()); assert.equal(calls, 3);
});

test('bad checksum, oversized payload, and wrong component identity stop until explicit retry', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const runtime = f.make({ fetch: async () => {
    calls++;
    if (calls === 1) return new Response(Buffer.alloc(f.bytes.length));
    if (calls === 2) return new Response(Buffer.concat([f.bytes, Buffer.from('extra')]));
    return new Response(f.bytes);
  } });
  const result = runtime.ensure();
  await until(async () => (await runtime.status()).status === 'failed');
  assert.equal((await runtime.status()).error, 'verification'); assert.equal(calls, 1);
  await runtime.retry();
  await until(async () => (await runtime.status()).status === 'failed');
  assert.equal(calls, 2);
  await runtime.retry(); assert.ok(await result);
  const wrong = f.make({ root: path.join(f.root, 'wrong'), manifest: async () => ({ ...f.manifest, platform: 'win32' }), fetch: async () => { assert.fail('untrusted identity'); } });
  await wrong.retry();
  await until(async () => (await wrong.status()).status === 'failed');
  assert.equal((await wrong.status()).error, 'manifest');
});

test('cancelling one waiter leaves its peer alive and a cancelled source never resumes on Retry', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const runtime = f.make({ fetch: async () => { calls++; if (calls === 1) throw new Error('offline'); return new Response(f.bytes); } });
  const cancel = new AbortController();
  const first = assert.rejects(runtime.ensure(cancel.signal), /removed/);
  const second = runtime.ensure();
  await until(async () => (await runtime.status()).status === 'failed');
  cancel.abort(new Error('removed')); await first;
  await runtime.retry(); assert.ok(await second); assert.equal(calls, 2);
});

test('last waiter cancellation aborts transfer, clears staging and prevents next-launch download', async (t) => {
  const f = await fixture(t);
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const runtime = f.make({ fetch: async (_url, init) => {
    started();
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const cancel = new AbortController();
  const result = assert.rejects(runtime.ensure(cancel.signal), /removed/);
  await entered; cancel.abort(new Error('removed'));
  const closing = runtime.close();
  await result; await closing;
  assert.equal((await runtime.status()).error, 'interrupted');
  assert.deepEqual((await fs.readdir(f.options.root)).filter((name) => name.startsWith('.staging-')), []);
  await runtime.close();
  const next = f.make({ fetch: async () => assert.fail('cancelled demand must not download on restart') });
  await next.resume();
  assert.equal((await next.status()).status, 'not-installed');
  assert.deepEqual(await fs.readdir(f.options.root), []);
});

test('tar extraction refuses files outside the component root', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.source, 'outside'), 'do not install');
  await tar.c({ file: f.archive, cwd: f.source, gzip: true }, ['outside']);
  const expanded = path.join(f.root, 'expanded'); await fs.mkdir(expanded);
  await assert.rejects(unpackExtractor(f.archive, expanded), /Invalid extractor archive path/);
  assert.deepEqual(await fs.readdir(expanded), []);
});


test('archive symlinks preserve bundled framework links but cannot escape the component', async (t) => {
  if (process.platform === 'win32') { t.skip('Windows components do not use framework symlinks'); return; }
  const f = await fixture(t);
  const component = path.join(f.source, 'stashbase-extract');
  await fs.mkdir(path.join(component, '_internal'));
  await fs.writeFile(path.join(component, '_internal', 'lib'), 'library');
  await fs.symlink('_internal/lib', path.join(component, 'link'));
  await tar.c({ file: f.archive, cwd: f.source, gzip: true }, ['stashbase-extract']);
  const safe = path.join(f.root, 'safe'); await fs.mkdir(safe);
  await unpackExtractor(f.archive, safe);
  assert.equal(await fs.readFile(path.join(safe, 'stashbase-extract', 'link'), 'utf8'), 'library');
  await fs.symlink('../../outside', path.join(component, 'escape'));
  await tar.c({ file: f.archive, cwd: f.source, gzip: true }, ['stashbase-extract']);
  const unsafe = path.join(f.root, 'unsafe'); await fs.mkdir(unsafe);
  await assert.rejects(unpackExtractor(f.archive, unsafe), /link escapes component/);
  assert.equal(await fs.lstat(path.join(unsafe, 'stashbase-extract', 'escape')).then(() => true, () => false), false);
});

test('failed source demand is removed on cancellation but explicit and shutdown demand survive', async (t) => {
  for (const mode of ['cancel', 'explicit', 'shutdown']) {
    const explicit = mode === 'explicit';
    const reason = mode === 'shutdown' ? 'shutdown' : new Error('removed');
    const f = await fixture(t);
    const runtime = f.make({ fetch: async () => { throw new Error('offline'); } });
    const cancel = new AbortController();
    const waiting = assert.rejects(runtime.ensure(cancel.signal), (error) => error === reason);
    await until(async () => (await runtime.status()).status === 'failed');
    if (explicit) {
      await runtime.retry();
      await until(async () => (await runtime.status()).status === 'failed');
    }
    cancel.abort(reason); await waiting; await runtime.close();
    let calls = 0;
    const next = f.make({ fetch: async () => { calls++; throw new Error('offline'); } });
    await next.resume();
    if (mode !== 'cancel') await until(async () => calls === 1);
    else assert.equal((await next.status()).status, 'not-installed');
    assert.equal(calls, mode !== 'cancel' ? 1 : 0);
  }
});

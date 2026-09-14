import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFilesystemPath } from './filesystem-path.ts';
import { isMfsDaemonRetiringError, MfsDaemon } from './mfs-daemon.ts';

const windowsPath = createFilesystemPath({ platform: 'win32', cwd: 'C:/' });

test('Unicode identity is evaluated only by Node, including Unicode 16 case pairs', () => {
  const garayUpper = '\u{10D50}';
  const garayLower = '\u{10D70}';
  assert.equal(
    windowsPath.identity(`C:/${garayUpper}`),
    windowsPath.identity(`c:/${garayLower}`),
  );
});

test('daemon readiness replays Folder bindings after every spawn', async (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-fake-mfs-'));
  const fixture = path.join(scratch, 'fake-daemon.mjs');
  fs.writeFileSync(fixture, `
    import readline from 'node:readline';
    const operations = [];
    process.stdout.write(JSON.stringify({ event: 'ready', db: 'fake' }) + '\\n');
    const lines = readline.createInterface({ input: process.stdin });
    lines.on('line', (line) => {
      const request = JSON.parse(line);
      operations.push(request.op);
      const result = request.op === 'status' ? { operations: [...operations] } : {};
      process.stdout.write(JSON.stringify({ id: request.id, ok: true, result }) + '\\n');
    });
  `, 'utf8');
  const daemon = new MfsDaemon(() => ({ command: process.execPath, args: [fixture], cwd: scratch }));
  t.after(async () => {
    await daemon.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  await daemon.bindFolder('/library/research', { provider: 'openai', dimension: 1536 });
  await daemon.close();
  const status = await daemon.call<{ operations: string[] }>('status', {});
  assert.deepEqual(status.operations, ['bind_folder', 'status']);
});

test('daemon close rejects in-flight work with a typed retirement interruption', async (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-fake-mfs-retirement-'));
  const fixture = path.join(scratch, 'fake-daemon.mjs');
  fs.writeFileSync(fixture, `
    import readline from 'node:readline';
    process.stdout.write(JSON.stringify({ event: 'ready', db: 'fake' }) + '\\n');
    readline.createInterface({ input: process.stdin }).on('line', (line) => {
      const request = JSON.parse(line);
      if (request.op === 'block') {
        process.stdout.write(JSON.stringify({ event: 'blocked' }) + '\\n');
        return;
      }
      process.stdout.write(JSON.stringify({ id: request.id, ok: true, result: {} }) + '\\n');
    });
  `, 'utf8');
  const daemon = new MfsDaemon(() => ({ command: process.execPath, args: [fixture], cwd: scratch }));
  t.after(async () => {
    await daemon.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  const blockedEvent = new Promise<void>((resolve) => daemon.once('daemon:blocked', () => resolve()));
  const blocked = daemon.call('block', {});
  const rejected = assert.rejects(blocked, isMfsDaemonRetiringError);
  await blockedEvent;
  await daemon.close();

  await rejected;
});

test('concurrent daemon closes share one retirement barrier before respawn', async (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-fake-mfs-close-'));
  const fixture = path.join(scratch, 'fake-daemon.mjs');
  const lock = path.join(scratch, 'daemon.lock');
  const launches = path.join(scratch, 'launches.log');
  fs.writeFileSync(fixture, `
    import fs from 'node:fs';
    import readline from 'node:readline';
    const [lock, launches] = process.argv.slice(2);
    fs.appendFileSync(launches, 'start\\n');
    let lockFd;
    try {
      lockFd = fs.openSync(lock, 'wx');
    } catch {
      process.stdout.write(JSON.stringify({ event: 'error', phase: 'daemon_lock', error: 'already held' }) + '\\n');
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({ event: 'ready', db: 'fake' }) + '\\n');
    const lines = readline.createInterface({ input: process.stdin });
    lines.on('line', (line) => {
      const request = JSON.parse(line);
      process.stdout.write(JSON.stringify({ id: request.id, ok: true, result: {} }) + '\\n');
    });
    lines.on('close', () => {
      setTimeout(() => {
        fs.closeSync(lockFd);
        fs.rmSync(lock, { force: true });
        process.exit(0);
      }, 150);
    });
  `, 'utf8');
  const daemon = new MfsDaemon(() => ({
    command: process.execPath,
    args: [fixture, lock, launches],
    cwd: scratch,
  }));
  t.after(async () => {
    await daemon.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  await daemon.call('status', {});
  const firstClose = daemon.close();
  const overlappingClose = daemon.close();
  const duringRetirement = daemon.call('status', {});
  await Promise.all([firstClose, overlappingClose, duringRetirement]);
  await daemon.call('status', {});

  assert.equal(fs.readFileSync(launches, 'utf8').trim().split('\n').length, 2);
});

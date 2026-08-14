import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFilesystemPath } from './filesystem-path.ts';
import { retainedIndexedSource } from './indexer.mfs.ts';
import { MfsDaemon } from './mfs-daemon.ts';

const windowsPath = createFilesystemPath({ platform: 'win32', cwd: 'C:/' });

test('legacy source spelling is rebased by the Node-owned Windows identity', () => {
  assert.equal(
    retainedIndexedSource(
      'c:/users/alice',
      'C:/Users/Alice/Docs/File.md',
      ['c:/users/alice'],
      windowsPath,
    ),
    'c:/users/alice/Docs/File.md',
  );
});

test('longest member root owns legacy source spelling migration', () => {
  assert.equal(
    retainedIndexedSource(
      'c:/library',
      'C:/Library/Nested/File.md',
      ['c:/library', 'c:/library/nested'],
      windowsPath,
    ),
    null,
  );
  assert.equal(
    retainedIndexedSource(
      'c:/library/nested',
      'C:/Library/Nested/File.md',
      ['c:/library', 'c:/library/nested'],
      windowsPath,
    ),
    'c:/library/nested/File.md',
  );
});

test('Unicode identity is evaluated only by Node, including Unicode 16 case pairs', () => {
  const garayUpper = '\u{10D50}';
  const garayLower = '\u{10D70}';
  assert.equal(
    windowsPath.identity(`C:/${garayUpper}`),
    windowsPath.identity(`c:/${garayLower}`),
  );
});

test('daemon readiness includes rules and binding replay after every spawn', async (t) => {
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
  assert.deepEqual(status.operations, ['set_rules', 'bind_folder', 'status']);
});

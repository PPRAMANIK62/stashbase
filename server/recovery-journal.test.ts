import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  RECOVERY_JOURNAL_KEY_BYTES,
  RECOVERY_JOURNAL_MAX_CONTENT_BYTES,
  RECOVERY_JOURNAL_MAX_ENTRIES,
  RECOVERY_JOURNAL_RETENTION_MS,
  createRecoveryJournal,
  recoveryDraftId,
  type RecoveryDraftSnapshot,
} from './recovery-journal.ts';

const FOLDER = path.resolve('/library/notes');
const OTHER_FOLDER = path.resolve('/library/other');
const KEY = crypto.randomBytes(RECOVERY_JOURNAL_KEY_BYTES);
const START = Date.parse('2026-01-01T00:00:00.000Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function snapshot(overrides: Partial<RecoveryDraftSnapshot> = {}): RecoveryDraftSnapshot {
  return {
    folderPath: FOLDER,
    relativePath: 'daily/today.md',
    expectedVersion: 'sha256:aaaa',
    content: '# draft',
    ...overrides,
  };
}

function harness(t: test.TestContext, key: Buffer | null = KEY) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-journal-')), 'journal');
  t.after(() => fs.rmSync(path.dirname(dir), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  let clock = START;
  const journal = createRecoveryJournal({ dir, key, now: () => clock });
  const files = () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
  return { dir, journal, files, advance: (ms: number) => { clock += ms; } };
}

test('constants hold the documented bounds', () => {
  assert.equal(RECOVERY_JOURNAL_MAX_CONTENT_BYTES, 2 * 1024 * 1024);
  assert.equal(RECOVERY_JOURNAL_MAX_ENTRIES, 64);
  assert.equal(RECOVERY_JOURNAL_RETENTION_MS, 14 * ONE_DAY_MS);
  assert.equal(RECOVERY_JOURNAL_KEY_BYTES, 32);
});

test('a wrong-length key is a programming error', () => {
  assert.throws(() => createRecoveryJournal({ dir: '/nowhere', key: Buffer.alloc(16) }), /32 bytes/);
});

test('write, list, and read round trip one entry per identity', async (t) => {
  const { journal, files, advance } = harness(t);
  const first = await journal.write(snapshot());
  assert.equal(first.status, 'stored');
  assert.equal(files().length, 1);
  assert.equal(files()[0], `${recoveryDraftId(snapshot())}.draft`);

  advance(1000);
  const second = await journal.write(snapshot({ content: '# newer', expectedVersion: 'sha256:bbbb' }));
  assert.equal(second.status, 'stored');
  assert.equal(files().length, 1, 'upsert keeps one file per identity');

  const listing = await journal.list(FOLDER);
  assert.ok(listing.available);
  assert.deepEqual(listing.entries, [{
    folderPath: FOLDER,
    relativePath: 'daily/today.md',
    expectedVersion: 'sha256:bbbb',
    savedAt: new Date(START + 1000).toISOString(),
  }]);
  assert.ok(!('content' in listing.entries[0]!));

  const record = await journal.read(snapshot());
  assert.equal(record?.content, '# newer');
  assert.equal(record?.expectedVersion, 'sha256:bbbb');
});

test('listing is scoped to the exact folder spelling and ordered newest first', async (t) => {
  const { journal, advance } = harness(t);
  await journal.write(snapshot({ relativePath: 'a.md' }));
  advance(1000);
  await journal.write(snapshot({ relativePath: 'b.md' }));
  await journal.write(snapshot({ folderPath: OTHER_FOLDER, relativePath: 'c.md' }));

  const listing = await journal.list(FOLDER);
  assert.ok(listing.available);
  assert.deepEqual(listing.entries.map((entry) => entry.relativePath), ['b.md', 'a.md']);
  const trailingSlash = await journal.list(`${FOLDER}${path.sep}`);
  assert.ok(trailingSlash.available);
  assert.deepEqual(trailingSlash.entries, []);
});

test('remove is idempotent and read reports absence', async (t) => {
  const { journal, files } = harness(t);
  await journal.remove(snapshot());
  await journal.write(snapshot());
  await journal.remove(snapshot());
  await journal.remove(snapshot());
  assert.deepEqual(files(), []);
  assert.equal(await journal.read(snapshot()), null);
});

test('a disabled journal never touches disk, still removes, and lists unavailable', async (t) => {
  const { dir, journal, files } = harness(t, null);
  assert.equal(journal.available, false);
  assert.deepEqual(await journal.write(snapshot()), { status: 'unavailable' });
  assert.equal(fs.existsSync(dir), false);
  assert.deepEqual(await journal.list(FOLDER), { available: false, reason: 'no-key' });
  assert.equal(await journal.read(snapshot()), null);

  fs.mkdirSync(dir, { recursive: true });
  const stale = path.join(dir, `${recoveryDraftId(snapshot())}.draft`);
  fs.writeFileSync(stale, 'left behind');
  await journal.remove(snapshot());
  assert.deepEqual(files(), []);
});

test('content over the byte bound is refused without writing', async (t) => {
  const { dir, journal } = harness(t);
  const multibyte = 'é'.repeat(RECOVERY_JOURNAL_MAX_CONTENT_BYTES / 2 + 1);
  assert.ok(multibyte.length <= RECOVERY_JOURNAL_MAX_CONTENT_BYTES, 'fits in characters but not bytes');
  assert.deepEqual(await journal.write(snapshot({ content: multibyte })), { status: 'too-large' });
  assert.equal(fs.existsSync(dir), false);
  const atBound = 'x'.repeat(RECOVERY_JOURNAL_MAX_CONTENT_BYTES);
  assert.equal((await journal.write(snapshot({ content: atBound }))).status, 'stored');
});

test('the oldest entries are evicted past the entry bound', async (t) => {
  const { journal, files, advance } = harness(t);
  for (let index = 0; index <= RECOVERY_JOURNAL_MAX_ENTRIES; index += 1) {
    await journal.write(snapshot({ relativePath: `note-${index}.md` }));
    advance(1000);
  }
  assert.equal(files().length, RECOVERY_JOURNAL_MAX_ENTRIES);
  assert.equal(await journal.read(snapshot({ relativePath: 'note-0.md' })), null);
  assert.ok(await journal.read(snapshot({ relativePath: 'note-1.md' })));
  assert.ok(await journal.read(snapshot({ relativePath: `note-${RECOVERY_JOURNAL_MAX_ENTRIES}.md` })));
});

test('entries expire after the retention window', async (t) => {
  const { journal, files, advance } = harness(t);
  await journal.write(snapshot());
  advance(RECOVERY_JOURNAL_RETENTION_MS + 1);
  const listing = await journal.list(FOLDER);
  assert.ok(listing.available);
  assert.deepEqual(listing.entries, []);
  assert.deepEqual(files(), []);

  await journal.write(snapshot());
  advance(RECOVERY_JOURNAL_RETENTION_MS + 1);
  assert.equal(await journal.read(snapshot()), null);
  assert.deepEqual(files(), []);
});

test('tampered, renamed, and foreign-key files are dropped as absent', async (t) => {
  const { dir, journal, files } = harness(t);
  const id = recoveryDraftId(snapshot());
  const file = path.join(dir, `${id}.draft`);

  await journal.write(snapshot());
  const bytes = fs.readFileSync(file);
  bytes[bytes.length - 1] ^= 0xff;
  fs.writeFileSync(file, bytes);
  assert.equal(await journal.read(snapshot()), null);
  assert.deepEqual(files(), []);

  await journal.write(snapshot());
  const otherId = recoveryDraftId(snapshot({ relativePath: 'elsewhere.md' }));
  fs.renameSync(file, path.join(dir, `${otherId}.draft`));
  assert.equal(await journal.read(snapshot({ relativePath: 'elsewhere.md' })), null);
  assert.deepEqual(files(), []);

  await journal.write(snapshot());
  fs.writeFileSync(path.join(dir, 'garbage.draft'), 'not an envelope');
  fs.writeFileSync(path.join(dir, `${id}.123.abc.tmp`), 'stray temp');
  const rotated = createRecoveryJournal({ dir, key: crypto.randomBytes(RECOVERY_JOURNAL_KEY_BYTES) });
  const listing = await rotated.list(FOLDER);
  assert.ok(listing.available);
  assert.deepEqual(listing.entries, []);
  assert.deepEqual(files(), []);
});

test('the envelope is sealed and the store is owner-only', async (t) => {
  const { dir, journal, files } = harness(t);
  await journal.write(snapshot({ content: 'SECRET DRAFT TEXT' }));
  const [name] = files();
  assert.ok(name);
  const bytes = fs.readFileSync(path.join(dir, name));
  assert.equal(bytes.subarray(0, 5).toString('ascii'), 'SBRJ1');
  assert.ok(!bytes.includes('SECRET DRAFT TEXT'));
  assert.ok(!bytes.includes(FOLDER));
  assert.ok(!files().some((entry) => entry.endsWith('.tmp')));
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(dir, name)).mode & 0o777, 0o600);
  }
});

test('garbage identities are refused before touching disk', async (t) => {
  const { dir, journal } = harness(t);
  await assert.rejects(journal.write(snapshot({ folderPath: 'relative/folder' })), /absolute/);
  await assert.rejects(journal.write(snapshot({ relativePath: '' })), /non-empty/);
  await assert.rejects(journal.write(snapshot({ relativePath: '/etc/passwd' })), /non-empty/);
  await assert.rejects(journal.write(snapshot({ relativePath: 'a/../b.md' })), /parent segment/);
  await assert.rejects(journal.read(snapshot({ relativePath: '..' })), /parent segment/);
  assert.equal(fs.existsSync(dir), false);
});

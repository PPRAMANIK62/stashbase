/**
 * Protected draft journal: bounded, encrypted snapshots of unsaved editable
 * text keyed by source identity. One file per entry under the server's
 * private local-data directory; the key comes from the Electron owner and is
 * never written here. See docs/frontend-migration/decisions/0017.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const RECOVERY_JOURNAL_MAX_CONTENT_BYTES = 2 * 1024 * 1024;
export const RECOVERY_JOURNAL_MAX_ENTRIES = 64;
export const RECOVERY_JOURNAL_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const RECOVERY_JOURNAL_KEY_BYTES = 32;

const ENVELOPE_MAGIC = Buffer.from('SBRJ1', 'ascii');
const ENVELOPE_IV_BYTES = 12;
const ENVELOPE_AUTH_TAG_BYTES = 16;
const ENVELOPE_HEADER_BYTES = ENVELOPE_MAGIC.length + ENVELOPE_IV_BYTES + ENVELOPE_AUTH_TAG_BYTES;
const CIPHER = 'aes-256-gcm';
const ENTRY_EXTENSION = '.draft';
const TEMP_EXTENSION = '.tmp';
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

export interface RecoveryDraftIdentity {
  folderPath: string;
  relativePath: string;
}

export interface RecoveryDraftSnapshot extends RecoveryDraftIdentity {
  expectedVersion: string;
  content: string;
}

export interface RecoveryDraftEntry extends RecoveryDraftIdentity {
  expectedVersion: string;
  /** ISO timestamp of the snapshot. */
  savedAt: string;
}

export interface RecoveryDraftRecord extends RecoveryDraftEntry {
  content: string;
}

export type RecoveryJournalWrite =
  | { status: 'stored'; entry: RecoveryDraftEntry }
  | { status: 'unavailable' }
  | { status: 'too-large' };

export type RecoveryJournalListing =
  | { available: true; entries: RecoveryDraftEntry[] }
  | { available: false; reason: 'no-key' };

export interface RecoveryJournal {
  /** False when no key was provisioned; writes and reads then refuse. */
  readonly available: boolean;
  /** Entries for exactly this stored folder spelling, newest first. Expired
   *  and undecodable files are deleted while listing. */
  list(folderPath: string): Promise<RecoveryJournalListing>;
  /** Null when absent, expired, undecodable, or the journal is unavailable. */
  read(identity: RecoveryDraftIdentity): Promise<RecoveryDraftRecord | null>;
  /** Idempotent; an absent entry is success. Needs no key. */
  remove(identity: RecoveryDraftIdentity): Promise<void>;
  /** Upsert: one entry per identity, the newest snapshot replaces. */
  write(snapshot: RecoveryDraftSnapshot): Promise<RecoveryJournalWrite>;
}

export interface RecoveryJournalOptions {
  dir: string;
  key: Buffer | null;
  now?: () => number;
}

const recordSchema = z
  .object({
    folderPath: z.string().min(1),
    relativePath: z.string().min(1),
    expectedVersion: z.string().min(1),
    savedAt: z.string().datetime(),
    content: z.string(),
  })
  .strict();

export function recoveryDraftId(identity: RecoveryDraftIdentity): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([identity.folderPath, identity.relativePath]))
    .digest('hex');
}

function assertIdentity(identity: RecoveryDraftIdentity): void {
  const { folderPath, relativePath } = identity;
  if (!path.isAbsolute(folderPath)) {
    throw new Error('recovery journal: folderPath must be absolute');
  }
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.startsWith('/')) {
    throw new Error('recovery journal: relativePath must be a non-empty folder-relative path');
  }
  if (relativePath.split(/[\\/]/).includes('..')) {
    throw new Error('recovery journal: relativePath must not contain a parent segment');
  }
}

function seal(key: Buffer, id: string, record: RecoveryDraftRecord): Buffer {
  const iv = crypto.randomBytes(ENVELOPE_IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER, key, iv, { authTagLength: ENVELOPE_AUTH_TAG_BYTES });
  cipher.setAAD(Buffer.from(id, 'ascii'));
  const body = Buffer.from(JSON.stringify(record), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
  return Buffer.concat([ENVELOPE_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

function open(key: Buffer, id: string, envelope: Buffer): RecoveryDraftRecord | null {
  if (envelope.length < ENVELOPE_HEADER_BYTES) return null;
  if (!envelope.subarray(0, ENVELOPE_MAGIC.length).equals(ENVELOPE_MAGIC)) return null;
  let offset = ENVELOPE_MAGIC.length;
  const iv = envelope.subarray(offset, offset += ENVELOPE_IV_BYTES);
  const authTag = envelope.subarray(offset, offset += ENVELOPE_AUTH_TAG_BYTES);
  const ciphertext = envelope.subarray(offset);
  try {
    const decipher = crypto.createDecipheriv(CIPHER, key, iv, { authTagLength: ENVELOPE_AUTH_TAG_BYTES });
    decipher.setAAD(Buffer.from(id, 'ascii'));
    decipher.setAuthTag(authTag);
    const body = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = recordSchema.safeParse(JSON.parse(body.toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function withoutContent(record: RecoveryDraftRecord): RecoveryDraftEntry {
  const { content: _content, ...entry } = record;
  return entry;
}

function newestFirst(left: RecoveryDraftEntry, right: RecoveryDraftEntry): number {
  return Date.parse(right.savedAt) - Date.parse(left.savedAt);
}

export function createRecoveryJournal(options: RecoveryJournalOptions): RecoveryJournal {
  const { dir, key } = options;
  if (key !== null && key.length !== RECOVERY_JOURNAL_KEY_BYTES) {
    throw new Error(`recovery journal key must be ${RECOVERY_JOURNAL_KEY_BYTES} bytes`);
  }
  const now = options.now ?? Date.now;

  const entryFile = (id: string): string => path.join(dir, `${id}${ENTRY_EXTENSION}`);
  const discard = (file: string): Promise<void> => fs.promises.rm(file, { force: true });

  const isExpired = (record: RecoveryDraftRecord): boolean =>
    now() - Date.parse(record.savedAt) > RECOVERY_JOURNAL_RETENTION_MS;

  /** The record behind one id, or null after deleting a file that cannot be
   *  used: corrupt, expired, or sealed under another key. A rotated key means
   *  those entries can never be recovered, so keeping them is only clutter. */
  async function load(usableKey: Buffer, id: string): Promise<RecoveryDraftRecord | null> {
    const file = entryFile(id);
    let envelope: Buffer;
    try {
      envelope = await fs.promises.readFile(file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
    const record = open(usableKey, id, envelope);
    if (!record || isExpired(record)) {
      await discard(file);
      return null;
    }
    return record;
  }

  /** Every usable record in the store; stray temp files and unusable entries
   *  are deleted on the way so repeated scans converge. */
  async function scan(usableKey: Buffer): Promise<Array<{ id: string; record: RecoveryDraftRecord }>> {
    let names: string[];
    try {
      names = await fs.promises.readdir(dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const found: Array<{ id: string; record: RecoveryDraftRecord }> = [];
    for (const name of names) {
      if (name.endsWith(TEMP_EXTENSION)) {
        await discard(path.join(dir, name));
        continue;
      }
      if (!name.endsWith(ENTRY_EXTENSION)) continue;
      const id = name.slice(0, -ENTRY_EXTENSION.length);
      const record = await load(usableKey, id);
      if (record) found.push({ id, record });
    }
    return found;
  }

  async function store(id: string, envelope: Buffer): Promise<void> {
    await fs.promises.mkdir(dir, { recursive: true, mode: DIRECTORY_MODE });
    const temp = path.join(dir, `${id}.${process.pid}.${crypto.randomBytes(6).toString('hex')}${TEMP_EXTENSION}`);
    const file = entryFile(id);
    try {
      await fs.promises.writeFile(temp, envelope, { mode: FILE_MODE });
      await fs.promises.rename(temp, file);
    } catch (err) {
      await discard(temp);
      throw err;
    }
    if (process.platform !== 'win32') {
      try { await fs.promises.chmod(dir, DIRECTORY_MODE); } catch { /* best effort on special filesystems */ }
      try { await fs.promises.chmod(file, FILE_MODE); } catch { /* best effort on special filesystems */ }
    }
  }

  async function evict(usableKey: Buffer): Promise<void> {
    // Counting names is enough to skip decrypting every entry on each write.
    const names = await fs.promises.readdir(dir).catch(() => [] as string[]);
    if (names.filter((name) => name.endsWith(ENTRY_EXTENSION)).length <= RECOVERY_JOURNAL_MAX_ENTRIES) return;
    const all = await scan(usableKey);
    if (all.length <= RECOVERY_JOURNAL_MAX_ENTRIES) return;
    const oldestFirst = all.sort((left, right) =>
      newestFirst(right.record, left.record) || left.id.localeCompare(right.id));
    for (const { id } of oldestFirst.slice(0, all.length - RECOVERY_JOURNAL_MAX_ENTRIES)) {
      await discard(entryFile(id));
    }
  }

  return {
    available: key !== null,

    async list(folderPath) {
      if (!key) return { available: false, reason: 'no-key' };
      const entries = (await scan(key))
        .map(({ record }) => record)
        .filter((record) => record.folderPath === folderPath)
        .map(withoutContent)
        .sort(newestFirst);
      return { available: true, entries };
    },

    async read(identity) {
      assertIdentity(identity);
      if (!key) return null;
      return load(key, recoveryDraftId(identity));
    },

    async remove(identity) {
      assertIdentity(identity);
      await discard(entryFile(recoveryDraftId(identity)));
    },

    async write(snapshot) {
      assertIdentity(snapshot);
      if (!key) return { status: 'unavailable' };
      if (Buffer.byteLength(snapshot.content, 'utf8') > RECOVERY_JOURNAL_MAX_CONTENT_BYTES) {
        return { status: 'too-large' };
      }
      const record: RecoveryDraftRecord = {
        folderPath: snapshot.folderPath,
        relativePath: snapshot.relativePath,
        expectedVersion: snapshot.expectedVersion,
        savedAt: new Date(now()).toISOString(),
        content: snapshot.content,
      };
      const id = recoveryDraftId(record);
      await store(id, seal(key, id, record));
      await evict(key);
      return { status: 'stored', entry: withoutContent(record) };
    },
  };
}

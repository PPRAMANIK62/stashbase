/** Current preparation failures/cancellations; MFS owns indexing state. */
import { createRequire } from 'node:module';
import type BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { logger, errorMessage } from './log.ts';
import { appStateDbPath } from './local-data.ts';
import { filesystemPath } from './filesystem-path.ts';

const log = logger('state-db');

export type ConversionStatus = 'in-flight' | 'done' | 'failed' | 'cancelled';

export interface ConversionStatusEntry {
  status: ConversionStatus;
  attempts: number;
  lastError?: string;
  lastAttemptAt: string;
  doneAt?: string;
}

const nodeRequire = createRequire(import.meta.url);

let DatabaseCtor: typeof BetterSqlite3 | null | undefined;
let db: BetterSqlite3.Database | null = null;
let dbPath: string | null = null;
let stateDbUnavailable = false;

function stateDbPath(): string {
  return appStateDbPath();
}

function loadDatabaseCtor(): typeof BetterSqlite3 | null {
  if (DatabaseCtor !== undefined) return DatabaseCtor;
  try {
    DatabaseCtor = nodeRequire('better-sqlite3') as typeof BetterSqlite3;
  } catch (err: unknown) {
    DatabaseCtor = null;
    log.warn(`state db disabled: ${errorMessage(err)}`);
  }
  return DatabaseCtor;
}

function getStateDb(): BetterSqlite3.Database | null {
  if (stateDbUnavailable) return null;
  const Database = loadDatabaseCtor();
  if (!Database) return null;
  const target = stateDbPath();
  if (db && dbPath === target) return db;
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    db = new Database(target);
    dbPath = target;
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  } catch (err: unknown) {
    log.warn(`state db disabled: ${errorMessage(err)}`);
    stateDbUnavailable = true;
    try { db?.close(); } catch { /* ignore */ }
    db = null;
    dbPath = null;
  }
  return db;
}

export function closeStateDb(): void {
  if (!db) return;
  try { db.close(); } catch { /* ignore */ }
  db = null;
  dbPath = null;
}

function initializeSchema(conn: BetterSqlite3.Database): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS conversions (
      path TEXT PRIMARY KEY,
      path_identity TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('in-flight', 'done', 'failed', 'cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT NOT NULL,
      done_at TEXT
    );
    CREATE INDEX IF NOT EXISTS conversions_status_idx ON conversions(status, last_attempt_at);
    CREATE UNIQUE INDEX IF NOT EXISTS conversions_path_identity_idx ON conversions(path_identity);
  `);
}

export function readConversionStatusMap(): Record<string, ConversionStatusEntry> {
  const conn = getStateDb();
  if (!conn) return {};
  const rows = conn.prepare(`
    SELECT path, status, attempts, last_error AS lastError,
           last_attempt_at AS lastAttemptAt, done_at AS doneAt
    FROM conversions
    ORDER BY path
  `).all() as Array<{ path: string } & ConversionStatusEntry>;
  const out: Record<string, ConversionStatusEntry> = {};
  for (const row of rows) {
    const { path: rowPath, ...entry } = row;
    out[rowPath] = {
      status: entry.status,
      attempts: entry.attempts,
      lastAttemptAt: entry.lastAttemptAt,
      ...(entry.lastError ? { lastError: entry.lastError } : {}),
      ...(entry.doneAt ? { doneAt: entry.doneAt } : {}),
    };
  }
  return out;
}

export function getConversionStatus(pathKey: string): ConversionStatusEntry | undefined {
  const conn = getStateDb();
  if (!conn) return undefined;
  const row = conn.prepare(`
    SELECT status, attempts, last_error AS lastError,
           last_attempt_at AS lastAttemptAt, done_at AS doneAt
    FROM conversions
    WHERE path_identity = ?
    LIMIT 1
  `).get(filesystemPath.identity(pathKey)) as ConversionStatusEntry | undefined;
  if (!row) return undefined;
  return {
    status: row.status,
    attempts: row.attempts,
    lastAttemptAt: row.lastAttemptAt,
    ...(row.lastError ? { lastError: row.lastError } : {}),
    ...(row.doneAt ? { doneAt: row.doneAt } : {}),
  };
}


export function setConversionStatus(pathKey: string, status: ConversionStatus, opts: { error?: string; incrementAttempts?: boolean } = {}): void {
  const conn = getStateDb();
  if (!conn) return;
  const prev = getConversionStatus(pathKey);
  const sourcePath = filesystemPath.absolute(pathKey);
  const pathIdentity = filesystemPath.identity(sourcePath);
  const now = new Date().toISOString();
  conn.prepare(`
    INSERT INTO conversions (path, path_identity, status, attempts, last_error, last_attempt_at, done_at)
    VALUES (@path, @pathIdentity, @status, @attempts, @lastError, @lastAttemptAt, @doneAt)
    ON CONFLICT(path_identity) DO UPDATE SET
      status = excluded.status,
      attempts = excluded.attempts,
      last_error = excluded.last_error,
      last_attempt_at = excluded.last_attempt_at,
      done_at = excluded.done_at
  `).run({
    path: sourcePath,
    pathIdentity,
    status,
    attempts: opts.incrementAttempts ? (prev?.attempts ?? 0) + 1 : (prev?.attempts ?? 1),
    lastError: opts.error ?? null,
    lastAttemptAt: now,
    doneAt: status === 'done' ? now : null,
  });
}

export function clearConversionStatus(pathKey: string): void {
  const conn = getStateDb();
  if (!conn) return;
  conn.prepare('DELETE FROM conversions WHERE path_identity = ?')
    .run(filesystemPath.identity(pathKey));
}

export function clearConversionStatusUnder(pathKey: string, excludedRoots: readonly string[] = []): void {
  const conn = getStateDb();
  if (!conn) return;
  const rows = conn.prepare('SELECT path_identity AS pathIdentity FROM conversions')
    .all() as Array<{ pathIdentity: string }>;
  const matches = rows
    .map((row) => row.pathIdentity)
    .filter((identity) => filesystemPath.contains(pathKey, identity)
      && !excludedRoots.some((root) => filesystemPath.contains(root, identity)));
  if (matches.length === 0) return;
  const remove = conn.prepare('DELETE FROM conversions WHERE path_identity = ?');
  conn.transaction((identities: string[]) => {
    for (const identity of identities) remove.run(identity);
  })(matches);
}

export function listConversionStatus(status: ConversionStatus): Array<{ path: string; entry: ConversionStatusEntry }> {
  const conn = getStateDb();
  if (!conn) return [];
  const rows = conn.prepare(`
    SELECT path, status, attempts, last_error AS lastError,
           last_attempt_at AS lastAttemptAt, done_at AS doneAt
    FROM conversions
    WHERE status = ?
    ORDER BY path
  `).all(status) as Array<{ path: string } & ConversionStatusEntry>;
  return rows.map((row) => ({
    path: row.path,
    entry: {
      status: row.status,
      attempts: row.attempts,
      lastAttemptAt: row.lastAttemptAt,
      ...(row.lastError ? { lastError: row.lastError } : {}),
      ...(row.doneAt ? { doneAt: row.doneAt } : {}),
    },
  }));
}

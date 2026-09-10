/** Folder-explicit crash-recovery draft routes. Every request names its
 *  library folder; membership is checked the same way as `/api/files?folder=`
 *  and the journal itself lives outside every folder. Listing responses carry
 *  metadata only; content is fetched per draft. */
import express from 'express';
import type { z } from 'zod';
import { fileVersionAsync } from '../active-file-operations.ts';
import { filesystemPath } from '../filesystem-path.ts';
import { sendError } from '../http.ts';
import { exactMemberFolderRootAsync, runWithFolderRoot } from '../folder.ts';
import { normalizeFolderRelativePath } from '../folder-relative-path.ts';
import {
  recoveryDraftContentResponseSchema,
  recoveryDraftDiscardResponseSchema,
  recoveryDraftFailureSchema,
  recoveryDraftIdentitySchema,
  recoveryDraftListResponseSchema,
  recoveryDraftWriteRequestSchema,
  recoveryDraftWriteResponseSchema,
  type RecoveryDraftFailureWire,
} from '../../shared/protocols/http/recovery-drafts.ts';
import type { RecoveryDraftEntry, RecoveryDraftIdentity, RecoveryJournal } from '../recovery-journal.ts';

export interface RecoveryDraftRouteDeps {
  journal: RecoveryJournal;
  /** Stored spelling of an exact member folder root, or null. */
  memberFolderRoot(rawFolder: string): Promise<string | null>;
  /** The source's version on disk now, or null when missing. */
  currentVersion(folderRoot: string, relativePath: string): Promise<string | null>;
}

export function createRecoveryDraftRouteDeps(journal: RecoveryJournal): RecoveryDraftRouteDeps {
  return {
    journal,
    memberFolderRoot: (rawFolder) =>
      filesystemPath.isAbsolute(rawFolder) ? exactMemberFolderRootAsync(rawFolder) : Promise.resolve(null),
    currentVersion: (folderRoot, relativePath) =>
      runWithFolderRoot(folderRoot, () => fileVersionAsync(relativePath)),
  };
}

interface Refusal {
  status: number;
  body: RecoveryDraftFailureWire;
}

type Resolution<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

const FOLDER_UNAVAILABLE: Refusal = {
  status: 400,
  body: { code: 'FOLDER_UNAVAILABLE', error: 'folder is not a registered library folder' },
};
const RECOVERY_UNAVAILABLE: Refusal = {
  status: 503,
  body: { code: 'RECOVERY_UNAVAILABLE', error: 'draft recovery is unavailable on this installation' },
};
const NOT_FOUND: Refusal = {
  status: 404,
  body: { code: 'NOT_FOUND', error: 'no draft for that source' },
};
const DRAFT_TOO_LARGE: Refusal = {
  status: 413,
  body: { code: 'DRAFT_TOO_LARGE', error: 'draft is larger than the recovery journal allows' },
};

function invalidPath(message: string): Refusal {
  return { status: 400, body: { code: 'INVALID_PATH', error: message } };
}

function refuse(res: express.Response, refusal: Refusal): void {
  res.status(refusal.status).json(recoveryDraftFailureSchema.parse(refusal.body));
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

type AsyncHandler = (req: express.Request, res: express.Response) => Promise<unknown>;

/** Express 4 drops rejected async handlers on the floor; route them to the
 *  shared error mapping instead of leaving the request hanging. */
function handle(handler: AsyncHandler): express.RequestHandler {
  return (req, res) => {
    handler(req, res).catch((err: unknown) => sendError(res, err));
  };
}

async function resolveFolder(deps: RecoveryDraftRouteDeps, rawFolder: string): Promise<Resolution<string>> {
  const trimmed = rawFolder.trim();
  const member = trimmed ? await deps.memberFolderRoot(trimmed) : null;
  return member ? { ok: true, value: member } : { ok: false, refusal: FOLDER_UNAVAILABLE };
}

async function resolveIdentity(
  deps: RecoveryDraftRouteDeps,
  raw: z.input<typeof recoveryDraftIdentitySchema>,
): Promise<Resolution<RecoveryDraftIdentity>> {
  const parsed = recoveryDraftIdentitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, refusal: invalidPath('folder and path are required') };
  const folder = await resolveFolder(deps, parsed.data.folderPath);
  if (!folder.ok) return folder;
  try {
    const relativePath = normalizeFolderRelativePath(parsed.data.path, { writable: true, allowQuotes: true });
    return { ok: true, value: { folderPath: folder.value, relativePath } };
  } catch (err) {
    return { ok: false, refusal: invalidPath(err instanceof Error ? err.message : 'invalid path') };
  }
}

async function summarize(deps: RecoveryDraftRouteDeps, entry: RecoveryDraftEntry) {
  const currentVersion = await deps.currentVersion(entry.folderPath, entry.relativePath).catch(() => null);
  return {
    currentVersion,
    expectedVersion: entry.expectedVersion,
    folderPath: entry.folderPath,
    path: entry.relativePath,
    savedAt: entry.savedAt,
  };
}

export function mount(app: express.Express, deps: RecoveryDraftRouteDeps): void {
  const { journal } = deps;

  app.get('/api/recovery-drafts', handle(async (req, res) => {
    const folder = await resolveFolder(deps, queryString(req.query.folder));
    if (!folder.ok) return refuse(res, folder.refusal);
    const listing = await journal.list(folder.value);
    if (!listing.available) {
      return res.json(recoveryDraftListResponseSchema.parse({ available: false, reason: listing.reason }));
    }
    const drafts = await Promise.all(listing.entries.map((entry) => summarize(deps, entry)));
    res.json(recoveryDraftListResponseSchema.parse({ available: true, drafts }));
  }));

  app.get('/api/recovery-drafts/content', handle(async (req, res) => {
    const identity = await resolveIdentity(deps, {
      folderPath: queryString(req.query.folder),
      path: queryString(req.query.path),
    });
    if (!identity.ok) return refuse(res, identity.refusal);
    if (!journal.available) return refuse(res, RECOVERY_UNAVAILABLE);
    const record = await journal.read(identity.value);
    if (!record) return refuse(res, NOT_FOUND);
    res.json(recoveryDraftContentResponseSchema.parse({
      ...(await summarize(deps, record)),
      content: record.content,
    }));
  }));

  app.put('/api/recovery-drafts', handle(async (req, res) => {
    const parsed = recoveryDraftWriteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const oversized = parsed.error.issues.some((issue) => issue.path[0] === 'content' && issue.code === 'too_big');
      return refuse(res, oversized ? DRAFT_TOO_LARGE : invalidPath('folderPath, path, expectedVersion, and content are required'));
    }
    const identity = await resolveIdentity(deps, { folderPath: parsed.data.folderPath, path: parsed.data.path });
    if (!identity.ok) return refuse(res, identity.refusal);
    const written = await journal.write({
      ...identity.value,
      expectedVersion: parsed.data.expectedVersion,
      content: parsed.data.content,
    });
    switch (written.status) {
      case 'unavailable':
        return refuse(res, RECOVERY_UNAVAILABLE);
      case 'too-large':
        return refuse(res, DRAFT_TOO_LARGE);
      case 'stored':
        return res.json(recoveryDraftWriteResponseSchema.parse({ savedAt: written.entry.savedAt }));
      default: {
        const exhaustive: never = written;
        return exhaustive;
      }
    }
  }));

  app.delete('/api/recovery-drafts', handle(async (req, res) => {
    const identity = await resolveIdentity(deps, {
      folderPath: queryString(req.query.folder),
      path: queryString(req.query.path),
    });
    if (!identity.ok) return refuse(res, identity.refusal);
    await journal.remove(identity.value);
    res.json(recoveryDraftDiscardResponseSchema.parse({}));
  }));
}

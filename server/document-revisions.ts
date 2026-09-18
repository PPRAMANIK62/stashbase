/**
 * Pending revision proposals: whole documents an agent hands to the reader
 * instead of writing to disk.
 *
 * The store is in memory and dies with the process deliberately. A proposal is
 * worth less than the session that made it: the agent that reasoned about the
 * document is gone after a restart, and the source may have moved on. Writing
 * proposals to durable config would buy staleness rules, crash-recovery rules,
 * and a second persistence model for document text, none of which this feature
 * needs.
 *
 * Parking returns immediately. It never waits on the reader the way a write
 * approval waits on a decision, because a revision is a handoff of work product
 * rather than a gate on an action the agent wants to take now. That is also why
 * this module, not a permission prompt, is the only thing standing between an
 * agent and the store: nothing throttles parking at human speed any more, so the
 * bounds below are the throttle.
 *
 * Proposals are keyed by source path, and a folder drains the ones that live
 * under it. Keying by the owning registered root instead would strand a
 * proposal whenever a nested folder is also registered: the path resolves to
 * the innermost root while the window that must show the review has the outer
 * one open. Removing on read is what stops two readers from opening the same
 * review, and it makes the drain converge, so a second read is an empty list
 * rather than an error. Delivery is at most once and a lost handoff is not
 * retried here; the renderer surfaces that failure instead.
 */
import { randomUUID } from 'node:crypto';

import { detectFormat } from './format.ts';
import { filesystemPath } from './filesystem-path.ts';
import { runWithFolderRoot } from './folder.ts';
import { exactRegisteredFolderRootAsync } from './folder.ts';
import {
  normalizeProjectFilePath,
  routeError,
  validateProjectTextMutation,
  validateProjectWritableFolderRel,
} from './project-file-access.ts';
import { readTextSnapshotAsync, withTextFileTransaction } from './text-file-transaction.ts';

/** A reviewable prose document, not a data dump. A megabyte of Markdown is
 *  several hundred pages, so a proposal past it is a caller mistake rather than
 *  something a person is going to read change by change. */
const MAX_PROPOSAL_BYTES = 1024 * 1024;

/** One sitting's worth of review. An agent that has parked fifty documents in
 *  one folder has stopped proposing and started enumerating, and the refusal
 *  tells it so while the reader can still drain what is already there. */
const MAX_PENDING_PER_FOLDER = 50;

/** A ceiling on what one undrained folder can hold, independent of how the
 *  count is spread across paths. */
const MAX_PENDING_BYTES_PER_FOLDER = 8 * 1024 * 1024;

/** A folder nobody opens is never drained, so age is the only thing that can
 *  release it. Longer than any working session a reader would come back to,
 *  short enough that a long-lived daemon does not accumulate forever. */
const PROPOSAL_TTL_MS = 6 * 60 * 60 * 1000;

/** Who proposed the revision. Only agents reach the host today; the renderer's
 *  developer trigger never leaves the renderer. */
export type RevisionOrigin = 'agent';

export interface PendingProposal {
  /** Identity shared by the tool answer, drain and transcript review card. */
  id: string;
  /** Absolute POSIX source path the proposal revises, and the store's key. */
  path: string;
  /** The complete proposed document. The diff engine segments it. */
  content: string;
  /** `sha256:` version of the content the proposal was computed against. It
   *  gates opening the review and nothing after it: from then on the editor
   *  recomputes changes against the live document. */
  baseVersion: string;
  origin: RevisionOrigin;
  /** Drives the expiry sweep. Nothing else reads it. */
  createdAt: number;
}

export type SuggestedRevision =
  | { id: string; path: string; parked: true; baseVersion: string; message: string }
  | { path: string; parked: false; reason: 'no-changes'; message: string };

export interface SuggestEditsOptions {
  /** The caller's own project. A proposal that lands outside the folder whose
   *  conversation produced it would surface in a window that never asked for
   *  it, so the handler refuses rather than relying on the request scope a
   *  transport may or may not have installed. */
  withinFolder?: string;
  /** Clock seam for the expiry sweep. */
  now?: () => number;
}

const pending = new Map<string, PendingProposal>();

/**
 * Park a whole-document revision for the reader without touching disk.
 *
 * Validation lives here rather than in the transports, so the MCP tool, an
 * external MCP client, and the local HTTP route all get the same refusals.
 */
export async function suggestProjectFileEdits(
  rawPath: unknown,
  content: string,
  opts: SuggestEditsOptions = {},
): Promise<SuggestedRevision> {
  const now = opts.now ?? Date.now;
  const target = await normalizeProjectFilePath(rawPath);
  validateProjectWritableFolderRel(target.folderRel);
  const withinFolder = opts.withinFolder;
  if (!withinFolder || !filesystemPath.isAbsolute(withinFolder)) {
    throw routeError('suggest_edits requires an attributed or explicit project.', 400, 'FOLDER_REQUIRED');
  }
  const member = await exactRegisteredFolderRootAsync(withinFolder);
  if (!member || !filesystemPath.equal(member, withinFolder)) {
    throw routeError('suggest_edits requires a registered project.', 404, 'FOLDER_NOT_FOUND');
  }
  if (!filesystemPath.contains(member, target.abs)) {
    throw routeError('Proposals must stay in the conversation project.', 403, 'PROJECT_SCOPE_MISMATCH');
  }
  validateProjectTextMutation(content);
  if (detectFormat(target.folderRel) !== 'md') {
    throw routeError(
      'suggest_edits proposes revisions to Markdown sources only. Every other family is preview-only '
      + 'or has no inline review surface, so there is nowhere to show the change. '
      + 'Use write_file or edit_file for those.',
      415,
      'UNSUPPORTED_FORMAT',
    );
  }
  const proposalBytes = Buffer.byteLength(content, 'utf8');
  if (proposalBytes > MAX_PROPOSAL_BYTES) {
    throw routeError(
      `proposal is ${proposalBytes} bytes; suggest_edits reviews documents up to ${MAX_PROPOSAL_BYTES} bytes. `
      + 'Split the document or write the change directly.',
      413,
      'PROPOSAL_TOO_LARGE',
    );
  }
  return runWithFolderRoot(target.folderRoot, async () =>
    // Read the snapshot and park under the same lock the write paths take, so a
    // `write_file` landing between the two cannot give the proposal a
    // baseVersion that was already stale when it was recorded.
    withTextFileTransaction(target.folderRel, async () => {
      const snapshot = await readTextSnapshotAsync(target.folderRel);
      if (snapshot == null) {
        throw routeError('not found; suggest_edits revises an existing document', 404);
      }
      if (snapshot.content === content) {
        // A proposal with nothing in it leaves the reader's diff review active
        // with zero changes to accept or reject, which blocks typing and offers
        // no way out of the document. Refuse rather than create that state.
        return {
          path: target.abs,
          parked: false,
          reason: 'no-changes',
          message: 'The proposal matches the file on disk. Nothing was parked and nothing changed.',
        };
      }
      sweepExpired(now());
      admit(target.folderRoot, target.abs, proposalBytes);
      // A newer proposal replaces an older undrained one. Once a proposal has
      // been drained the store cannot see its review at all, so keeping one open
      // review per document is the renderer's job, not this map's.
      const id = randomUUID();
      pending.set(target.abs, {
        id,
        path: target.abs,
        content,
        baseVersion: snapshot.version,
        origin: 'agent',
        createdAt: now(),
      });
      return {
        id,
        path: target.abs,
        parked: true,
        baseVersion: snapshot.version,
        message: 'Parked for review. StashBase shows the proposal inside the open document as tracked '
          + 'insertions and deletions; the file changes only when the reader accepts one. '
          + 'Keep working, this does not wait for them.',
      };
    }));
}

/** Refuse a park that would push the folder past what a reader can work
 *  through. Replacing a path already parked costs no new slot. */
function admit(folderRoot: string, abs: string, proposalBytes: number): void {
  let count = 0;
  let bytes = proposalBytes;
  for (const proposal of pending.values()) {
    if (!filesystemPath.contains(folderRoot, proposal.path)) continue;
    if (proposal.path === abs) continue;
    count++;
    bytes += Buffer.byteLength(proposal.content, 'utf8');
  }
  if (count >= MAX_PENDING_PER_FOLDER) {
    throw routeError(
      `this folder already holds ${count} revisions waiting to be reviewed, the most suggest_edits parks at once. `
      + 'Wait for them to be reviewed before proposing more.',
      429,
      'TOO_MANY_PENDING_PROPOSALS',
    );
  }
  if (bytes > MAX_PENDING_BYTES_PER_FOLDER) {
    throw routeError(
      `this folder's unreviewed revisions would reach ${bytes} bytes, past the ${MAX_PENDING_BYTES_PER_FOLDER}-byte limit. `
      + 'Wait for them to be reviewed before proposing more.',
      429,
      'TOO_MANY_PENDING_PROPOSALS',
    );
  }
}

function sweepExpired(nowMs: number): void {
  for (const proposal of [...pending.values()]) {
    if (nowMs - proposal.createdAt >= PROPOSAL_TTL_MS) pending.delete(proposal.path);
  }
}

/** Hand the proposals under `folder` to one reader and forget them. */
export function drainPendingProposals(folder: string, now: () => number = Date.now): PendingProposal[] {
  sweepExpired(now());
  const drained: PendingProposal[] = [];
  for (const proposal of pending.values()) {
    if (filesystemPath.contains(folder, proposal.path)) drained.push(proposal);
  }
  for (const proposal of drained) pending.delete(proposal.path);
  return drained;
}

/** Removing a project retires everything it owns, proposals included. Without
 *  this, re-adding the same path in one session would hand the new window a
 *  review written against the folder the reader deliberately let go. A retained
 *  nested project keeps its own, the way it keeps its preparation. */
export function forgetFolderProposals(folder: string, retainedRoots: readonly string[] = []): void {
  for (const proposal of [...pending.values()]) {
    if (!filesystemPath.contains(folder, proposal.path)) continue;
    if (retainedRoots.some((root) => filesystemPath.contains(root, proposal.path))) continue;
    pending.delete(proposal.path);
  }
}

/** A renamed document keeps its pending review. The proposal is still the text
 *  the agent wrote, and the version gate catches it if the bytes moved on. */
export function remapProposalPath(oldAbs: string, newAbs: string): void {
  const proposal = pending.get(oldAbs);
  if (!proposal) return;
  pending.delete(oldAbs);
  pending.set(newAbs, { ...proposal, path: newAbs });
}

/** A deleted document has no review to open. */
export function forgetProposal(abs: string): void {
  pending.delete(abs);
}

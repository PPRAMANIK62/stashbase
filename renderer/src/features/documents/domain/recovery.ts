/**
 * Unsaved text a previous session left in the journal, as the reader decides
 * about it: which source, when it was typed, whether the file it was typed
 * over is still the file on disk, and what restoring one does to the open
 * document. Every transition here is over the editor's text; nothing in this
 * module writes the source.
 */
import type { SourceReference } from '@/shared/domain/source-reference';

import { documentEditorText, sourceIdentity, type DocumentState } from './document';

/** One journaled draft as the server lists it: which source it was typed
 *  over, at which version, and what version that source has on disk now. */
export interface RecoveryDraftSummary {
  /** The source's version on disk at listing time; null when it is gone. */
  currentVersion: string | null;
  expectedVersion: string;
  savedAt: string;
  source: SourceReference;
}

/** How the draft relates to the source on disk now. `current` restores as
 *  plain unsaved text; `changed` meets the conflict comparison on its first
 *  save; `missing` can still be restored, and the save recreates the file. */
export type RecoveryStaleness = 'changed' | 'current' | 'missing';

export interface RecoveryCandidate {
  readonly expectedVersion: string;
  readonly savedAt: string;
  readonly source: SourceReference;
  readonly staleness: RecoveryStaleness;
}

export function recoveryStaleness(
  expectedVersion: string,
  currentVersion: string | null,
): RecoveryStaleness {
  if (currentVersion === null) return 'missing';
  return currentVersion === expectedVersion ? 'current' : 'changed';
}

export function toRecoveryCandidate(summary: RecoveryDraftSummary): RecoveryCandidate {
  return {
    expectedVersion: summary.expectedVersion,
    savedAt: summary.savedAt,
    source: summary.source,
    staleness: recoveryStaleness(summary.expectedVersion, summary.currentVersion),
  };
}

/** The one sentence a candidate carries beside its name, if its staleness
 *  needs saying before the reader restores it. */
export function recoveryCandidateNote(candidate: RecoveryCandidate): string | null {
  switch (candidate.staleness) {
    case 'changed':
      return 'The file changed since this draft.';
    case 'missing':
      return 'The file no longer exists.';
    case 'current':
      return null;
    default: {
      const exhaustive: never = candidate.staleness;
      return exhaustive;
    }
  }
}

export function recoveryCandidateKey(candidate: Pick<RecoveryCandidate, 'source'>): string {
  return sourceIdentity(candidate.source);
}

/** Candidates newest first, so the draft the reader most likely wants sits
 *  at the top. */
export function sortRecoveryCandidates(
  candidates: readonly RecoveryCandidate[],
): RecoveryCandidate[] {
  return candidates.toSorted((left, right) => right.savedAt.localeCompare(left.savedAt));
}

/** Unsaved text recovered from a previous session, and the version it was
 *  typed over. */
export interface RecoveredDraft {
  content: string;
  expectedVersion: string;
}

/**
 * Loads a recovered draft over the loaded source as unsaved text. The editor
 * keeps the disk text as its baseline, so dirtiness is still `value !==
 * baseline`, but its version becomes the one the draft was typed over: a
 * draft older than the file meets the versioned save's conflict path instead
 * of landing over newer bytes. A draft identical to the disk text changes
 * nothing, and the caller reads that from the unchanged state.
 */
export function restoreDocumentDraft(state: DocumentState, draft: RecoveredDraft): DocumentState {
  if (state.lifecycle === 'disposed' || state.access !== 'editable' || !state.editor) return state;
  const editor = state.editor;
  if (editor.save.kind === 'conflict' || editor.save.kind === 'saving') return state;
  const value = documentEditorText(draft.content);
  if (value === editor.baseline) return state;
  return {
    ...state,
    editor: {
      ...editor,
      restores: editor.restores + 1,
      revision: editor.revision + 1,
      save: { kind: 'dirty' },
      value,
      version: draft.expectedVersion,
    },
  };
}

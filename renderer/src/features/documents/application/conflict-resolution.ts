/**
 * Carrying out the reader's conflict decision against the source.
 *
 * The decision itself is the reader's and its state lives in
 * `domain/conflict-state.ts`; this is the part that touches the file and the
 * query cache. Every path here rebases on the version that was actually
 * reviewed, so a decision made about one disk version can never be applied to
 * a newer one: a write refused as changed goes back to comparison rather than
 * winning, and a newer source that cannot be read leaves both versions whole.
 */
import type { StoreApi } from 'zustand/vanilla';

import { buildConflictMarkerDraft } from '@/features/documents/domain/conflict-diff';
import {
  acceptDocumentOverwrite,
  beginDocumentConflictResolution,
  enterDocumentConflict,
  failDocumentConflictResolution,
  mergeDocumentConflict,
  reloadDocumentConflict,
} from '@/features/documents/domain/conflict-state';
import {
  documentConflict,
  type DocumentConflictResolution,
  type DocumentScope,
  type DocumentState,
} from '@/features/documents/domain/document';
import { documentTextFormat } from '@/features/documents/domain/document-format';
import type { CapturedScope } from '@/shared/runtime/scope-guard';

import { documentFailure, DOCUMENT_OVERWRITE_MESSAGES } from './failure-messages';
import { DocumentSaveError, type DocumentQueryScope, type DocumentSourcePort } from './ports';

/** The open document a resolution runs against. */
export interface ConflictResolutionContext {
  accept(captured: CapturedScope<DocumentScope>, completion: () => void): boolean;
  capture(): CapturedScope<DocumentScope>;
  queries: DocumentQueryScope;
  /** Retires the writes still in flight against the pre-resolution base. */
  retireOperations(): void;
  readonly scope: DocumentScope;
  signal: AbortSignal;
  store: StoreApi<DocumentState>;
}

export async function resolveDocumentConflict(
  context: ConflictResolutionContext,
  api: DocumentSourcePort,
  resolution: DocumentConflictResolution,
): Promise<boolean> {
  const { accept, capture, queries, retireOperations, scope, signal, store } = context;
  const editorState = store.getState().editor;
  const conflict = editorState ? documentConflict(editorState) : null;
  if (!conflict || conflict.resolving) return false;
  const format = documentTextFormat(scope.source.path);
  if (!format) return false;
  store.setState((state) => beginDocumentConflictResolution(state, resolution));
  const diskSource = { content: conflict.diskContent, format, version: conflict.diskVersion };

  // Both local resolutions rebase the editor on what is now on disk, so
  // anything still in flight against the old base is retired first.
  if (resolution === 'reload') {
    retireOperations();
    queries.replaceSource(diskSource);
    store.setState(reloadDocumentConflict);
    return true;
  }
  if (resolution === 'merge') {
    retireOperations();
    const merged = buildConflictMarkerDraft(conflict.editorContent, conflict.diskContent);
    queries.replaceSource(diskSource);
    store.setState((state) => mergeDocumentConflict(state, merged));
    return true;
  }

  const captured = capture();
  try {
    const saved = await api.save(
      captured.scope.source,
      { baseVersion: conflict.diskVersion, content: conflict.editorContent },
      signal,
    );
    return accept(captured, () => {
      queries.replaceSource(saved);
      store.setState((state) => acceptDocumentOverwrite(state, saved));
    });
  } catch (error) {
    if (error instanceof DocumentSaveError && error.kind === 'conflict') {
      try {
        const disk = await api.load(captured.scope.source, signal);
        accept(captured, () => store.setState((state) => enterDocumentConflict(state, disk)));
        return false;
      } catch {
        /* Keep both reviewed versions if the newer source cannot be read. */
      }
    }
    accept(captured, () =>
      store.setState((state) =>
        failDocumentConflictResolution(
          state,
          documentFailure(error, 'DocumentSaveError', DOCUMENT_OVERWRITE_MESSAGES).message,
        ),
      ),
    );
    return false;
  }
}

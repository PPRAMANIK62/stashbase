/**
 * What a save discovered on disk, and the reader's decision about it.
 *
 * A conflict is not a failure to report and forget: both versions stay whole
 * until the reader chooses one, so every transition here is written as a step
 * of that choice. The comparison the reader is shown is built in
 * `conflict-diff.ts`; this module owns only the state that choice moves
 * through, which is why nothing below can lose either version by itself.
 */
import {
  documentConflict,
  documentEditorText,
  type DocumentConflictResolution,
  type DocumentState,
  type DocumentTextSaveResult,
  type DocumentTextSource,
} from './document';

export function enterDocumentConflict(
  state: DocumentState,
  diskSource: DocumentTextSource,
): DocumentState {
  const editor = state.editor;
  if (!editor || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: {
      ...editor,
      save: {
        kind: 'conflict',
        conflict: {
          diskContent: documentEditorText(diskSource.content),
          diskVersion: diskSource.version,
          editorContent: editor.value,
          resolutionMessage: null,
          resolving: null,
        },
      },
    },
  };
}

export function beginDocumentConflictResolution(
  state: DocumentState,
  resolution: DocumentConflictResolution,
): DocumentState {
  const editor = state.editor;
  const conflict = editor ? documentConflict(editor) : null;
  if (!editor || !conflict || conflict.resolving || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: {
      ...editor,
      save: {
        kind: 'conflict',
        conflict: { ...conflict, resolutionMessage: null, resolving: resolution },
      },
    },
  };
}

export function failDocumentConflictResolution(
  state: DocumentState,
  message: string,
): DocumentState {
  const editor = state.editor;
  const conflict = editor ? documentConflict(editor) : null;
  if (!editor || !conflict || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: {
      ...editor,
      save: {
        kind: 'conflict',
        conflict: { ...conflict, resolutionMessage: message, resolving: null },
      },
    },
  };
}

export function reloadDocumentConflict(state: DocumentState): DocumentState {
  const editor = state.editor;
  const conflict = editor ? documentConflict(editor) : null;
  if (!editor || !conflict || conflict.resolving !== 'reload') return state;
  return {
    ...state,
    editor: {
      ...editor,
      baseline: conflict.diskContent,
      save: { kind: 'clean' },
      value: conflict.diskContent,
      version: conflict.diskVersion,
    },
  };
}

export function mergeDocumentConflict(state: DocumentState, mergedContent: string): DocumentState {
  const editor = state.editor;
  const conflict = editor ? documentConflict(editor) : null;
  if (!editor || !conflict || conflict.resolving !== 'merge') return state;
  return {
    ...state,
    editor: {
      ...editor,
      baseline: conflict.diskContent,
      revision: editor.revision + 1,
      save: { kind: 'merging', finishing: false, message: null },
      value: mergedContent,
      version: conflict.diskVersion,
    },
  };
}

export function acceptDocumentOverwrite(
  state: DocumentState,
  result: DocumentTextSaveResult,
): DocumentState {
  const editor = state.editor;
  const conflict = editor ? documentConflict(editor) : null;
  if (!editor || conflict?.resolving !== 'overwrite') return state;
  const baseline = documentEditorText(result.content);
  const warning = result.indexWarning ?? null;
  return {
    ...state,
    editor: {
      ...editor,
      baseline,
      save: warning === null ? { kind: 'saved' } : { kind: 'warned', message: warning },
      value: baseline,
      version: result.version,
    },
  };
}

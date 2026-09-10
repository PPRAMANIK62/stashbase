/**
 * One open document's editable state.
 *
 * The save lifecycle is a single discriminated union rather than a phase enum
 * beside loose flags, so a conflict always carries its two versions and a
 * failure always carries its sentence. `dirty` is derived from the text —
 * `value !== baseline` — because storing it separately let the two disagree.
 */
import type { SourceReference } from '@/shared/domain/source-reference';

import type { DocumentTextFormat } from './document-format';

export interface DocumentScope {
  readonly generation: number;
  readonly id: string;
  readonly source: SourceReference;
}

export interface DocumentState {
  access: DocumentAccess;
  editor: DocumentEditorState | null;
  jsonSession: JsonDocumentSession;
  lifecycle: 'active' | 'disposed';
  markdownMode: MarkdownViewMode;
  pdfPage: number;
  scope: DocumentScope;
}

export type DocumentAccess = 'editable' | 'read-only';

export type MarkdownViewMode = 'reading' | 'writer';

type JsonViewMode = 'source' | 'tree';

export interface JsonDocumentSession {
  expandedPaths: string[];
  search: string;
  searchOptions: { caseSensitive: boolean; wholeWord: boolean };
  selectedPath: string | null;
  viewMode: JsonViewMode | null;
}

export interface DocumentTextSource {
  content: string;
  format: DocumentTextFormat;
  version: string;
}

export interface DocumentTextSaveResult extends DocumentTextSource {
  indexWarning?: string;
}

export type DocumentConflictResolution = 'merge' | 'overwrite' | 'reload';

export interface DocumentConflictState {
  diskContent: string;
  diskVersion: string;
  editorContent: string;
  resolutionMessage: string | null;
  resolving: DocumentConflictResolution | null;
}

/**
 * Where one document sits in the save lifecycle. Exactly one variant holds at
 * a time and each carries only what that outcome means: a warning sentence
 * belongs to a landed save, a conflict to the two versions being compared.
 */
export type DocumentSaveState =
  | { kind: 'clean' }
  | { kind: 'conflict'; conflict: DocumentConflictState }
  | { kind: 'dirty' }
  | { kind: 'failed'; message: string }
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'warned'; message: string };

export interface DocumentEditorState {
  baseline: string;
  /** How many recovered drafts have replaced this text. A viewer that refuses
   *  outside text while dirty remounts on it, so a restore is the one external
   *  replacement that reaches the reader. */
  restores: number;
  revision: number;
  save: DocumentSaveState;
  value: string;
  version: string;
}

/** Unsaved text, or a conflict whose editor side is still the user's draft. */
export function isDocumentDirty(editor: DocumentEditorState): boolean {
  return editor.save.kind === 'conflict' || editor.value !== editor.baseline;
}

export function documentConflict(editor: DocumentEditorState): DocumentConflictState | null {
  return editor.save.kind === 'conflict' ? editor.save.conflict : null;
}

/** The sentence a save outcome shows, if it has one. */
export function documentSaveMessage(save: DocumentSaveState): string | null {
  switch (save.kind) {
    case 'failed':
    case 'warned':
      return save.message;
    case 'conflict':
      return save.conflict.resolutionMessage;
    case 'clean':
    case 'dirty':
    case 'saved':
    case 'saving':
      return null;
    default: {
      const exhaustive: never = save;
      return exhaustive;
    }
  }
}

export function sourceIdentity(source: SourceReference): string {
  return JSON.stringify([source.folderPath, source.path]);
}

export function sameSource(left: SourceReference, right: SourceReference): boolean {
  return left.folderPath === right.folderPath && left.path === right.path;
}

export function sourceName(source: SourceReference): string {
  return source.path.split('/').at(-1) ?? source.path;
}

export function documentAccess(source: SourceReference, activeFolderPath: string): DocumentAccess {
  return source.folderPath === activeFolderPath ? 'editable' : 'read-only';
}

export function documentEditorText(source: string): string {
  return source.replace(/\r\n?/gu, '\n');
}

export function createDocumentState(scope: DocumentScope, access: DocumentAccess): DocumentState {
  return {
    access,
    editor: null,
    jsonSession: {
      expandedPaths: ['$'],
      search: '',
      searchOptions: { caseSensitive: false, wholeWord: false },
      selectedPath: '$',
      viewMode: null,
    },
    lifecycle: 'active',
    markdownMode: access === 'editable' ? 'writer' : 'reading',
    pdfPage: 1,
    scope,
  };
}

export function setDocumentPdfPage(state: DocumentState, page: number): DocumentState {
  if (state.lifecycle === 'disposed' || !Number.isSafeInteger(page) || page < 1) return state;
  return state.pdfPage === page ? state : { ...state, pdfPage: page };
}

export function setDocumentJsonSession(
  state: DocumentState,
  patch: Partial<JsonDocumentSession>,
): DocumentState {
  if (state.lifecycle === 'disposed') return state;
  const jsonSession = { ...state.jsonSession, ...patch };
  if (
    jsonSession.viewMode === state.jsonSession.viewMode &&
    jsonSession.search === state.jsonSession.search &&
    jsonSession.selectedPath === state.jsonSession.selectedPath &&
    jsonSession.expandedPaths === state.jsonSession.expandedPaths &&
    jsonSession.searchOptions === state.jsonSession.searchOptions
  ) {
    return state;
  }
  return { ...state, jsonSession };
}

export function setDocumentMarkdownMode(
  state: DocumentState,
  mode: MarkdownViewMode,
): DocumentState {
  if (
    state.lifecycle === 'disposed' ||
    state.markdownMode === mode ||
    (mode === 'writer' && state.access !== 'editable')
  ) {
    return state;
  }
  return { ...state, markdownMode: mode };
}

export function reconcileDocumentSource(
  state: DocumentState,
  source: DocumentTextSource,
): DocumentState {
  if (state.lifecycle === 'disposed' || state.access !== 'editable') return state;
  const baseline = documentEditorText(source.content);
  const editor = state.editor;
  if (editor && (isDocumentDirty(editor) || editor.save.kind === 'saving')) return state;
  if (
    editor?.baseline === baseline &&
    editor.value === baseline &&
    editor.version === source.version
  ) {
    return state;
  }
  return {
    ...state,
    editor: {
      baseline,
      restores: editor?.restores ?? 0,
      revision: editor?.revision ?? 0,
      save: { kind: 'clean' },
      value: baseline,
      version: source.version,
    },
  };
}

export function changeDocumentText(state: DocumentState, value: string): DocumentState {
  if (state.lifecycle === 'disposed' || state.access !== 'editable' || !state.editor) return state;
  const editor = state.editor;
  if (editor.save.kind === 'conflict') return state;
  if (editor.value === value) return state;
  const dirty = value !== editor.baseline;
  const save: DocumentSaveState =
    editor.save.kind === 'saving'
      ? { kind: 'saving' }
      : dirty
        ? { kind: 'dirty' }
        : { kind: 'saved' };
  return {
    ...state,
    editor: { ...editor, revision: editor.revision + 1, save, value },
  };
}

export function beginDocumentSave(state: DocumentState): DocumentState {
  const editor = state.editor;
  if (!editor || state.lifecycle === 'disposed') return state;
  if (editor.save.kind === 'conflict' || !isDocumentDirty(editor)) return state;
  return { ...state, editor: { ...editor, save: { kind: 'saving' } } };
}

export function acceptDocumentSave(
  state: DocumentState,
  capturedRevision: number,
  result: DocumentTextSaveResult,
): DocumentState {
  const editor = state.editor;
  if (!editor || state.lifecycle === 'disposed') return state;
  const baseline = documentEditorText(result.content);
  const value = editor.revision === capturedRevision ? baseline : editor.value;
  const warning = result.indexWarning ?? null;
  const save: DocumentSaveState =
    value === baseline
      ? warning === null
        ? { kind: 'saved' }
        : { kind: 'warned', message: warning }
      : { kind: 'dirty' };
  return {
    ...state,
    editor: { ...editor, baseline, save, value, version: result.version },
  };
}

export function rejectDocumentSave(state: DocumentState, message: string): DocumentState {
  if (!state.editor || state.lifecycle === 'disposed') return state;
  return { ...state, editor: { ...state.editor, save: { kind: 'failed', message } } };
}

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
      save: mergedContent === conflict.diskContent ? { kind: 'saved' } : { kind: 'dirty' },
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

export function disposeDocumentState(state: DocumentState): DocumentState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}

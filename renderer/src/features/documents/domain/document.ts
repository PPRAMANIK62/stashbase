import type { SourceReference } from '@/shared/domain/source-reference';

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
  scope: DocumentScope;
}

export type DocumentAccess = 'editable' | 'read-only';

export type MarkdownViewMode = 'reading' | 'writer';

export type DocumentTextFormat = 'json' | 'md' | 'txt';

export type JsonViewMode = 'source' | 'tree';

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

export type DocumentSavePhase =
  | 'conflict'
  | 'error'
  | 'idle'
  | 'saved'
  | 'saving'
  | 'unsaved'
  | 'warning';

export type DocumentConflictResolution = 'merge' | 'overwrite' | 'reload';

export interface DocumentConflictState {
  diskContent: string;
  diskVersion: string;
  editorContent: string;
  resolutionMessage: string | null;
  resolving: DocumentConflictResolution | null;
}

export interface DocumentEditorState {
  baseline: string;
  conflict: DocumentConflictState | null;
  conflictVersion: string | null;
  dirty: boolean;
  revision: number;
  saveMessage: string | null;
  savePhase: DocumentSavePhase;
  value: string;
  version: string;
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

export function documentTextFormat(path: string): DocumentTextFormat | null {
  const extension = path.split('.').at(-1)?.toLowerCase();
  if (extension === 'md' || extension === 'markdown') return 'md';
  if (extension === 'json') return 'json';
  return extension === 'txt' ? 'txt' : null;
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
    scope,
  };
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
  if (state.editor?.dirty || state.editor?.savePhase === 'saving') return state;
  if (
    state.editor?.baseline === baseline &&
    state.editor.value === baseline &&
    state.editor.version === source.version
  ) {
    return state;
  }
  return {
    ...state,
    editor: {
      baseline,
      conflict: null,
      conflictVersion: null,
      dirty: false,
      revision: state.editor?.revision ?? 0,
      saveMessage: null,
      savePhase: 'idle',
      value: baseline,
      version: source.version,
    },
  };
}

export function changeDocumentText(state: DocumentState, value: string): DocumentState {
  if (state.lifecycle === 'disposed' || state.access !== 'editable' || !state.editor) return state;
  if (state.editor.conflict) return state;
  if (state.editor.value === value) return state;
  const dirty = value !== state.editor.baseline;
  const savePhase = state.editor.savePhase === 'saving' ? 'saving' : dirty ? 'unsaved' : 'saved';
  return {
    ...state,
    editor: {
      ...state.editor,
      conflictVersion: null,
      dirty,
      revision: state.editor.revision + 1,
      saveMessage: null,
      savePhase,
      value,
    },
  };
}

export function beginDocumentSave(state: DocumentState): DocumentState {
  if (!state.editor?.dirty || state.editor.conflict || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: { ...state.editor, saveMessage: null, savePhase: 'saving' },
  };
}

export function acceptDocumentSave(
  state: DocumentState,
  capturedRevision: number,
  result: DocumentTextSaveResult,
): DocumentState {
  if (!state.editor || state.lifecycle === 'disposed') return state;
  const baseline = documentEditorText(result.content);
  const value = state.editor.revision === capturedRevision ? baseline : state.editor.value;
  const dirty = value !== baseline;
  return {
    ...state,
    editor: {
      ...state.editor,
      baseline,
      conflict: null,
      conflictVersion: null,
      dirty,
      saveMessage: dirty ? null : (result.indexWarning ?? null),
      savePhase: dirty ? 'unsaved' : result.indexWarning ? 'warning' : 'saved',
      value,
      version: result.version,
    },
  };
}

export function rejectDocumentSave(
  state: DocumentState,
  failure: { conflictVersion?: string | null; message: string },
): DocumentState {
  if (!state.editor || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: {
      ...state.editor,
      conflictVersion: failure.conflictVersion ?? null,
      saveMessage: failure.message,
      savePhase: 'error',
    },
  };
}

export function enterDocumentConflict(
  state: DocumentState,
  diskSource: DocumentTextSource,
  message: string,
): DocumentState {
  if (!state.editor || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: {
      ...state.editor,
      conflict: {
        diskContent: documentEditorText(diskSource.content),
        diskVersion: diskSource.version,
        editorContent: state.editor.value,
        resolutionMessage: null,
        resolving: null,
      },
      conflictVersion: diskSource.version,
      dirty: true,
      saveMessage: message,
      savePhase: 'conflict',
    },
  };
}

export function beginDocumentConflictResolution(
  state: DocumentState,
  resolution: DocumentConflictResolution,
): DocumentState {
  if (
    !state.editor?.conflict ||
    state.editor.conflict.resolving ||
    state.lifecycle === 'disposed'
  ) {
    return state;
  }
  return {
    ...state,
    editor: {
      ...state.editor,
      conflict: { ...state.editor.conflict, resolutionMessage: null, resolving: resolution },
      saveMessage: null,
    },
  };
}

export function failDocumentConflictResolution(
  state: DocumentState,
  message: string,
): DocumentState {
  if (!state.editor?.conflict || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: {
      ...state.editor,
      conflict: { ...state.editor.conflict, resolutionMessage: message, resolving: null },
      saveMessage: message,
      savePhase: 'conflict',
    },
  };
}

export function reloadDocumentConflict(state: DocumentState): DocumentState {
  const conflict = state.editor?.conflict;
  if (!state.editor || !conflict || conflict.resolving !== 'reload') return state;
  return {
    ...state,
    editor: {
      ...state.editor,
      baseline: conflict.diskContent,
      conflict: null,
      conflictVersion: null,
      dirty: false,
      saveMessage: null,
      savePhase: 'idle',
      value: conflict.diskContent,
      version: conflict.diskVersion,
    },
  };
}

export function mergeDocumentConflict(state: DocumentState, mergedContent: string): DocumentState {
  const conflict = state.editor?.conflict;
  if (!state.editor || !conflict || conflict.resolving !== 'merge') return state;
  return {
    ...state,
    editor: {
      ...state.editor,
      baseline: conflict.diskContent,
      conflict: null,
      conflictVersion: null,
      dirty: mergedContent !== conflict.diskContent,
      revision: state.editor.revision + 1,
      saveMessage: null,
      savePhase: mergedContent === conflict.diskContent ? 'saved' : 'unsaved',
      value: mergedContent,
      version: conflict.diskVersion,
    },
  };
}

export function acceptDocumentOverwrite(
  state: DocumentState,
  result: DocumentTextSaveResult,
): DocumentState {
  if (!state.editor?.conflict || state.editor.conflict.resolving !== 'overwrite') return state;
  const baseline = documentEditorText(result.content);
  return {
    ...state,
    editor: {
      ...state.editor,
      baseline,
      conflict: null,
      conflictVersion: null,
      dirty: false,
      saveMessage: result.indexWarning ?? null,
      savePhase: result.indexWarning ? 'warning' : 'saved',
      value: baseline,
      version: result.version,
    },
  };
}

export function disposeDocumentState(state: DocumentState): DocumentState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}

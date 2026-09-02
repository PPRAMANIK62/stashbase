import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentScope {
  readonly generation: number;
  readonly id: string;
  readonly source: SourceReference;
}

export interface DocumentState {
  access: DocumentAccess;
  editor: DocumentEditorState | null;
  lifecycle: 'active' | 'disposed';
  scope: DocumentScope;
}

export type DocumentAccess = 'editable' | 'read-only';

export type DocumentTextFormat = 'md' | 'txt';

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

export interface DocumentEditorState {
  baseline: string;
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
  return extension === 'txt' ? 'txt' : null;
}

export function documentAccess(source: SourceReference, activeFolderPath: string): DocumentAccess {
  return source.folderPath === activeFolderPath ? 'editable' : 'read-only';
}

export function documentEditorText(source: string): string {
  return source.replace(/\r\n?/gu, '\n');
}

export function createDocumentState(scope: DocumentScope, access: DocumentAccess): DocumentState {
  return { access, editor: null, lifecycle: 'active', scope };
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
  if (!state.editor?.dirty || state.lifecycle === 'disposed') return state;
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
  failure: { conflictVersion?: string | null; message: string; phase: 'conflict' | 'error' },
): DocumentState {
  if (!state.editor || state.lifecycle === 'disposed') return state;
  return {
    ...state,
    editor: {
      ...state.editor,
      conflictVersion: failure.conflictVersion ?? null,
      saveMessage: failure.message,
      savePhase: failure.phase,
    },
  };
}

export function disposeDocumentState(state: DocumentState): DocumentState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}

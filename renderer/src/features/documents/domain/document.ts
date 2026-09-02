import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentScope {
  readonly generation: number;
  readonly id: string;
  readonly source: SourceReference;
}

export interface DocumentState {
  access: DocumentAccess;
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

export function createDocumentState(scope: DocumentScope, access: DocumentAccess): DocumentState {
  return { access, lifecycle: 'active', scope };
}

export function disposeDocumentState(state: DocumentState): DocumentState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}

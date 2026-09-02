import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentScope {
  readonly generation: number;
  readonly id: string;
  readonly source: SourceReference;
}

export interface DocumentState {
  lifecycle: 'active' | 'disposed';
  scope: DocumentScope;
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

export function createDocumentState(scope: DocumentScope): DocumentState {
  return { lifecycle: 'active', scope };
}

export function disposeDocumentState(state: DocumentState): DocumentState {
  return state.lifecycle === 'disposed' ? state : { ...state, lifecycle: 'disposed' };
}

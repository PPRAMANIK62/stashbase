import type { SourceReference } from '@/shared/domain/source-reference';

import { exactSearchFileId, type ExactSearchNavigationIntent } from './exact-search';

export const SEMANTIC_SEARCH_CANDIDATES = 30;
const SNIPPET_LENGTH = 200;

export type SearchScope = 'folder' | 'library';

export interface SemanticSearchRequest {
  /** Present when the scope is one member folder; absent for the library. */
  readonly folderPath?: string;
  readonly query: string;
  readonly topK: number;
}

export interface SemanticHit {
  readonly chunkIndex: number;
  /** Raw chunk body; anchors navigation and is never trimmed. */
  readonly content: string;
  readonly endLine?: number;
  readonly heading: string;
  readonly id: string;
  readonly pdfPage?: number;
  readonly score: number;
  /** Whitespace-collapsed, bounded copy of `content` for a result row. */
  readonly snippet: string;
  readonly source: SourceReference;
  readonly startLine?: number;
}

export interface SemanticSearchResult {
  readonly hits: readonly SemanticHit[];
  readonly truncated: boolean;
}

export interface SemanticHitGroup {
  readonly folderPath: string;
  readonly hits: readonly SemanticHit[];
}

export function semanticHitId(source: SourceReference, chunkIndex: number): string {
  return `${exactSearchFileId(source)}\u0000${chunkIndex}`;
}

export function semanticSnippet(content: string): string {
  const collapsed = content.replace(/\s+/gu, ' ').trim();
  return collapsed.length > SNIPPET_LENGTH
    ? `${collapsed.slice(0, SNIPPET_LENGTH - 1)}…`
    : collapsed;
}

/** Rank order is preserved in both shapes. In library scope a folder group
 *  sits where its strongest hit ranks, so a later folder never jumps ahead. */
export function groupSemanticHits(
  hits: readonly SemanticHit[],
  scope: SearchScope,
): SemanticHitGroup[] {
  if (scope === 'folder') {
    const first = hits[0];
    return first ? [{ folderPath: first.source.folderPath, hits }] : [];
  }
  const groups = new Map<string, SemanticHit[]>();
  for (const hit of hits) {
    const bucket = groups.get(hit.source.folderPath);
    if (bucket) bucket.push(hit);
    else groups.set(hit.source.folderPath, [hit]);
  }
  return [...groups.entries()].map(([folderPath, groupHits]) => ({ folderPath, hits: groupHits }));
}

function anchorLine(content: string): string {
  const line = content
    .split(/\r?\n/u)
    .map((candidate) => candidate.replace(/^#+\s*/u, '').trim())
    .find((candidate) => candidate.length > 0);
  return (line ?? '').slice(0, 120);
}

/** Opens the source at the chunk's first line, using the document Find
 *  target the exact path already understands. A chunk without a line
 *  anchor opens at the top. */
export function semanticNavigationIntent(hit: SemanticHit): ExactSearchNavigationIntent {
  return {
    source: hit.source,
    target: {
      caseSensitive: false,
      line: hit.startLine ?? 1,
      occurrenceIndex: 0,
      ...(hit.pdfPage === undefined ? {} : { pdfPage: hit.pdfPage }),
      query: anchorLine(hit.content),
      wholeWord: false,
    },
    type: 'open-search-source',
  };
}

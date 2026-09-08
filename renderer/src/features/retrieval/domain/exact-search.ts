import type { SourceReference } from '@/shared/domain/source-reference';

export interface ExactSearchRange {
  readonly end: number;
  readonly start: number;
}

export interface ExactSearchMatch {
  readonly audioTimestampMs?: number;
  readonly line: number;
  readonly pdfPage?: number;
  readonly ranges: readonly ExactSearchRange[];
  readonly text: string;
}

export interface ExactSearchFile {
  readonly id: string;
  readonly matches: readonly ExactSearchMatch[];
  readonly source: SourceReference;
  readonly totalMatches: number;
}

export interface ExactSearchResult {
  readonly files: readonly ExactSearchFile[];
  readonly totalMatches: number;
  readonly truncated: boolean;
}

export interface ExactSearchRequest {
  readonly caseSensitive: boolean;
  readonly folderPath?: string;
  readonly query: string;
  readonly wholeWord: boolean;
}

export interface ExactSearchNavigationIntent {
  readonly source: SourceReference;
  readonly target: {
    readonly audioTimestampMs?: number;
    readonly caseSensitive: boolean;
    readonly line: number;
    readonly occurrenceIndex: number;
    readonly pdfPage?: number;
    readonly query: string;
    readonly wholeWord: boolean;
  };
  readonly type: 'open-search-source';
}

export interface ExactSearchOccurrence {
  readonly file: ExactSearchFile;
  readonly id: string;
  readonly match: ExactSearchMatch;
  readonly occurrenceIndex: number;
  readonly range: ExactSearchRange;
}

export interface ExactSearchSegment {
  readonly highlighted: boolean;
  readonly offset: number;
  readonly text: string;
}

export function exactSearchFileId(source: SourceReference): string {
  return `${source.folderPath}\u0000${source.path}`;
}

export function exactSearchOccurrences(file: ExactSearchFile): ExactSearchOccurrence[] {
  let occurrenceIndex = 0;
  return file.matches.flatMap((match, matchIndex) =>
    match.ranges.map((range, rangeIndex) => ({
      file,
      id: `${file.id}\u0000${matchIndex}\u0000${rangeIndex}`,
      match,
      occurrenceIndex: occurrenceIndex++,
      range,
    })),
  );
}

export function exactSearchNavigationIntent(
  occurrence: ExactSearchOccurrence,
  request: ExactSearchRequest,
): ExactSearchNavigationIntent {
  return {
    source: occurrence.file.source,
    target: {
      ...(occurrence.match.audioTimestampMs === undefined
        ? {}
        : { audioTimestampMs: occurrence.match.audioTimestampMs }),
      caseSensitive: request.caseSensitive,
      line: occurrence.match.line,
      occurrenceIndex: occurrence.occurrenceIndex,
      ...(occurrence.match.pdfPage === undefined ? {} : { pdfPage: occurrence.match.pdfPage }),
      query: request.query,
      wholeWord: request.wholeWord,
    },
    type: 'open-search-source',
  };
}

export function exactSearchSegments(
  text: string,
  ranges: readonly ExactSearchRange[],
): ExactSearchSegment[] {
  const normalized = ranges
    .map(({ start, end }) => ({ start: Math.max(0, start), end: Math.min(text.length, end) }))
    .filter(({ start, end }) => end > start && start < text.length);
  const ordered: Array<{ end: number; start: number }> = [];
  for (const range of normalized) {
    const insertion = ordered.findIndex(
      (current) =>
        range.start < current.start || (range.start === current.start && range.end < current.end),
    );
    if (insertion === -1) ordered.push(range);
    else ordered.splice(insertion, 0, range);
  }
  const segments: ExactSearchSegment[] = [];
  let cursor = 0;
  for (const range of ordered) {
    const start = Math.max(cursor, range.start);
    if (start > cursor) {
      segments.push({ highlighted: false, offset: cursor, text: text.slice(cursor, start) });
    }
    if (range.end > start) {
      segments.push({ highlighted: true, offset: start, text: text.slice(start, range.end) });
      cursor = range.end;
    }
  }
  if (cursor < text.length) {
    segments.push({ highlighted: false, offset: cursor, text: text.slice(cursor) });
  }
  return segments.length > 0 ? segments : [{ highlighted: false, offset: 0, text }];
}

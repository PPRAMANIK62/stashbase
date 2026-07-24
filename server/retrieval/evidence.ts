import { filesystemPath } from '../filesystem-path.ts';
import type { SearchHit } from '../indexer.ts';
import type { KeywordHitFile } from '../search-display.ts';

export interface SourceLocator {
  line?: number;
  endLine?: number;
  page?: number;
  timestampMs?: number;
}

/** A single source-safe match. `sourcePath` is always an absolute visible path. */
export interface SourceEvidence {
  sourcePath: string;
  snippet: string;
  ranges?: Array<[number, number]>;
  heading?: string;
  locator: SourceLocator;
  score?: number;
  /** Opaque compatibility metadata, never a path or prepared representation. */
  chunkIndex?: number;
  /** Total keyword matches for this source before the evidence list was capped. */
  sourceMatchCount?: number;
}

/** Compatibility adapter for existing semantic HTTP and MCP payloads. */
export function semanticHitsFromEvidence(evidence: SourceEvidence[]): SearchHit[] {
  return evidence.map((entry, index) => ({
    fileName: entry.sourcePath,
    chunkIndex: entry.chunkIndex ?? index,
    content: entry.snippet,
    heading: entry.heading ?? '',
    ...(entry.locator.line == null ? {} : { startLine: entry.locator.line }),
    ...(entry.locator.endLine == null ? {} : { endLine: entry.locator.endLine }),
    ...(entry.locator.page == null ? {} : { pdfPage: entry.locator.page }),
    score: entry.score ?? 0,
  }));
}

/** Compatibility adapter for the renderer's grouped keyword payload. */
export function keywordFilesFromEvidence(evidence: SourceEvidence[], folderRoot: string): KeywordHitFile[] {
  const files = new Map<string, KeywordHitFile>();
  for (const entry of evidence) {
    const path = filesystemPath.relative(folderRoot, entry.sourcePath) ?? entry.sourcePath;
    const bucket = files.get(path) ?? { path, matches: [], totalMatches: 0 };
    bucket.matches.push({
      line: entry.locator.line ?? 1,
      text: entry.snippet,
      ranges: entry.ranges ?? [],
      ...(entry.locator.page == null ? {} : { pdfPage: entry.locator.page }),
      ...(entry.locator.timestampMs == null ? {} : { audioTimestampMs: entry.locator.timestampMs }),
    });
    bucket.totalMatches = Math.max(
      bucket.totalMatches,
      entry.sourceMatchCount ?? (bucket.totalMatches + Math.max(1, entry.ranges?.length ?? 0)),
    );
    files.set(path, bucket);
  }
  return [...files.values()]
    .map((file) => ({ ...file, matches: file.matches.sort((a, b) => a.line - b.line) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

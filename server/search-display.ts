import { displayPathForHit } from './pdf.ts';
import type { SearchHit } from './indexer.ts';

export interface KeywordMatch {
  line: number;
  text: string;
  ranges: Array<[number, number]>;
}

export interface KeywordHitFile {
  path: string;
  matches: KeywordMatch[];
  totalMatches: number;
}

export interface KeywordSearchResult {
  files: KeywordHitFile[];
  totalMatches: number;
  truncated: boolean;
}

export function remapKeywordFilesForDisplay(
  files: KeywordHitFile[],
  baseAbs: string,
): Pick<KeywordSearchResult, 'files' | 'totalMatches'> {
  const byPath = new Map<string, KeywordHitFile>();
  const seenMatches = new Map<string, Set<string>>();

  for (const file of files) {
    const display = displayPathForHit(file.path, baseAbs);
    if (display == null) continue;
    let bucket = byPath.get(display);
    if (!bucket) {
      bucket = { path: display, matches: [], totalMatches: 0 };
      byPath.set(display, bucket);
      seenMatches.set(display, new Set());
    }
    const seen = seenMatches.get(display)!;
    for (const match of file.matches) {
      const key = `${match.line}\0${match.text}\0${JSON.stringify(match.ranges)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      bucket.matches.push(match);
    }
    bucket.totalMatches = Math.max(bucket.totalMatches, file.totalMatches, bucket.matches.length);
  }

  const out = Array.from(byPath.values())
    .map((file) => ({
      ...file,
      matches: [...file.matches].sort((a, b) => a.line - b.line),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    files: out,
    totalMatches: out.reduce((sum, file) => sum + file.totalMatches, 0),
  };
}

export function remapSearchHitsForDisplay(hits: SearchHit[], baseAbs: string): SearchHit[] {
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const display = displayPathForHit(hit.fileName, baseAbs);
    if (display == null) continue;
    const next = { ...hit, fileName: display };
    const key = [
      next.fileName,
      next.content,
      next.heading,
      next.startLine ?? '',
      next.endLine ?? '',
    ].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

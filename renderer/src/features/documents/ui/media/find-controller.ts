import type {
  DocumentFindController,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';
import type { MediaTranscriptSegment } from '@/features/documents/domain/media';

interface MediaFindMatch {
  offset: number;
  segment: MediaTranscriptSegment;
}

const wordCharacter = /[\p{L}\p{N}_]/u;

function isWholeWord(text: string, start: number, length: number): boolean {
  const before = text[start - 1];
  const after = text[start + length];
  return (!before || !wordCharacter.test(before)) && (!after || !wordCharacter.test(after));
}

function findMatches(
  segments: readonly MediaTranscriptSegment[],
  query: string,
  options: FindOptions,
): MediaFindMatch[] {
  const needle = options.caseSensitive ? query : query.toLowerCase();
  if (!needle) return [];
  const matches: MediaFindMatch[] = [];
  for (const segment of segments) {
    const text = options.caseSensitive ? segment.text : segment.text.toLowerCase();
    let offset = 0;
    while (offset <= text.length - needle.length) {
      const found = text.indexOf(needle, offset);
      if (found === -1) break;
      if (!options.wholeWord || isWholeWord(text, found, needle.length)) {
        matches.push({ offset: found, segment });
      }
      offset = found + Math.max(needle.length, 1);
    }
  }
  return matches;
}

export function createMediaFindController(
  segments: readonly MediaTranscriptSegment[],
  onMatch: (segment: MediaTranscriptSegment | null) => void,
): DocumentFindController {
  let matches: MediaFindMatch[] = [];
  let index = -1;

  const result = (): FindMatchInfo => ({
    current: index >= 0 ? index + 1 : 0,
    total: matches.length,
  });
  const select = (next: number): FindMatchInfo => {
    if (matches.length === 0) {
      index = -1;
      onMatch(null);
      return result();
    }
    index = (next + matches.length) % matches.length;
    onMatch(matches[index]?.segment ?? null);
    return result();
  };
  const setQuery = (query: string, options: FindOptions): FindMatchInfo => {
    matches = findMatches(segments, query, options);
    return select(0);
  };

  return {
    close() {
      matches = [];
      index = -1;
      onMatch(null);
    },
    next: () => select(index + 1),
    previous: () => select(index - 1),
    restoreQuery: setQuery,
    setQuery,
  };
}

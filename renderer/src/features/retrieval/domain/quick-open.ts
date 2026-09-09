import { isRetrievableViewerFormat, type ViewerFormat } from '@/contracts/file-formats';
import type { SourceReference } from '@/shared/domain/source-reference';

type QuickOpenAction = 'open' | 'reveal';
type QuickOpenRetrievalAccess = 'included' | 'excluded';

/** Whether retrieval reaches a file of this format. A generic file opens and
 *  reveals like any other; it is only search that cannot see it, which is
 *  retrieval's own rule rather than the shell's. */
export function retrievalAccessFor(format: ViewerFormat): QuickOpenRetrievalAccess {
  return isRetrievableViewerFormat(format) ? 'included' : 'excluded';
}

export interface QuickOpenSource {
  action: QuickOpenAction;
  retrievalAccess: QuickOpenRetrievalAccess;
  source: SourceReference;
}

export interface QuickOpenItem extends QuickOpenSource {
  basename: string;
  parentPath: string;
  score: number;
}

export type QuickOpenNavigationIntent =
  | { type: 'open-source'; source: SourceReference }
  | { type: 'reveal-source'; source: SourceReference };

function pathParts(path: string): { basename: string; parentPath: string } {
  const separator = path.lastIndexOf('/');
  return separator === -1
    ? { basename: path, parentPath: '' }
    : { basename: path.slice(separator + 1), parentPath: path.slice(0, separator) };
}

function fuzzyScore(value: string, query: string): number | null {
  const candidate = value.toLowerCase();
  const expected = query.toLowerCase();
  let previous = -2;
  let cursor = 0;
  let score = 0;

  for (const character of expected) {
    const match = candidate.indexOf(character, cursor);
    if (match === -1) return null;
    score += match === previous + 1 ? 12 : 2;
    score += Math.max(0, 8 - match);
    previous = match;
    cursor = match + 1;
  }

  return score - candidate.length / 100;
}

function compareQuickOpenItems(left: QuickOpenItem, right: QuickOpenItem): number {
  return (
    right.score - left.score ||
    left.basename.localeCompare(right.basename, undefined, { sensitivity: 'base' }) ||
    left.source.path.localeCompare(right.source.path, undefined, { sensitivity: 'base' })
  );
}

function mergeRankedItems(left: QuickOpenItem[], right: QuickOpenItem[]): QuickOpenItem[] {
  const merged: QuickOpenItem[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  for (;;) {
    const nextLeft = left[leftIndex];
    const nextRight = right[rightIndex];
    if (nextLeft === undefined || nextRight === undefined) break;
    if (compareQuickOpenItems(nextLeft, nextRight) <= 0) {
      merged.push(nextLeft);
      leftIndex += 1;
    } else {
      merged.push(nextRight);
      rightIndex += 1;
    }
  }
  return merged.concat(left.slice(leftIndex), right.slice(rightIndex));
}

function rankItems(items: QuickOpenItem[]): QuickOpenItem[] {
  if (items.length < 2) return items;
  const middle = Math.floor(items.length / 2);
  return mergeRankedItems(rankItems(items.slice(0, middle)), rankItems(items.slice(middle)));
}

export function rankQuickOpenSources(
  sources: readonly QuickOpenSource[],
  query: string,
): QuickOpenItem[] {
  const normalized = query.trim();
  const items = sources
    .map((source) => {
      const { basename, parentPath } = pathParts(source.source.path);
      if (!normalized) return { ...source, basename, parentPath, score: 0 };

      const basenameScore = fuzzyScore(basename, normalized);
      const pathScore = fuzzyScore(source.source.path, normalized);
      if (basenameScore === null && pathScore === null) return null;

      return {
        ...source,
        basename,
        parentPath,
        score: Math.max(
          basenameScore === null ? Number.NEGATIVE_INFINITY : basenameScore + 100,
          pathScore ?? Number.NEGATIVE_INFINITY,
        ),
      };
    })
    .filter((item): item is QuickOpenItem => item !== null);
  return rankItems(items);
}

export function quickOpenNavigationIntent(item: QuickOpenItem): QuickOpenNavigationIntent {
  return item.action === 'open'
    ? { type: 'open-source', source: item.source }
    : { type: 'reveal-source', source: item.source };
}

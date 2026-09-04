import { EditorView } from '@codemirror/view';

import type {
  DocumentFindController,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';

export function textMatches(
  text: string,
  query: string,
  options: FindOptions,
): Array<{ from: number; to: number }> {
  if (!query) return [];
  const haystack = options.caseSensitive ? text : text.toLocaleLowerCase();
  const needle = options.caseSensitive ? query : query.toLocaleLowerCase();
  const matches: Array<{ from: number; to: number }> = [];
  for (
    let from = haystack.indexOf(needle);
    from >= 0;
    from = haystack.indexOf(needle, from + Math.max(1, needle.length))
  ) {
    const to = from + needle.length;
    if (!options.wholeWord || (isBoundary(text, from - 1) && isBoundary(text, to))) {
      matches.push({ from, to });
    }
  }
  return matches;
}

export function createCodeFindController(getView: () => EditorView | null): DocumentFindController {
  let cursor = -1;
  let matches: Array<{ from: number; to: number }> = [];
  let options: FindOptions = { caseSensitive: false, wholeWord: false };
  let query = '';
  const report = (): FindMatchInfo => ({
    current: cursor < 0 ? 0 : cursor + 1,
    total: matches.length,
  });
  const recompute = (preserveSelection: boolean, select: boolean) => {
    const view = getView();
    const previous = cursor;
    matches = view ? textMatches(view.state.doc.toString(), query, options) : [];
    cursor =
      matches.length === 0 ? -1 : preserveSelection ? Math.min(previous, matches.length - 1) : 0;
    if (select && view && cursor >= 0) selectMatch(view, matches[cursor]);
    return report();
  };
  const step = (direction: 1 | -1) => {
    const view = getView();
    if (!view) return report();
    matches = textMatches(view.state.doc.toString(), query, options);
    if (matches.length === 0) {
      cursor = -1;
      return report();
    }
    cursor = Math.min(cursor, matches.length - 1);
    cursor = (cursor + direction + matches.length) % matches.length;
    selectMatch(view, matches[cursor]);
    return report();
  };

  return {
    close() {
      cursor = -1;
      matches = [];
      query = '';
    },
    next: () => step(1),
    previous: () => step(-1),
    restoreQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(true, false);
    },
    setQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(false, true);
    },
  };
}

function isBoundary(text: string, index: number): boolean {
  return index < 0 || index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);
}

function selectMatch(view: EditorView, match: { from: number; to: number }): void {
  view.dispatch({
    effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
    selection: { anchor: match.from, head: match.to },
  });
  view.focus();
}

import { EditorView } from '@codemirror/view';

import { createFindMatchCursor } from '@/features/documents/application/find-cursor';
import type {
  DocumentFindController,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';

export function textMatches(
  text: string,
  query: string,
  options: FindOptions,
): Array<{ from: number; to: number }> {
  if (!query) return [];
  const haystack = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
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

/** Find over the editor's live document, selecting each match in the view. */
export function createCodeFindController(getView: () => EditorView | null): DocumentFindController {
  return createFindMatchCursor<{ from: number; to: number }>({
    collect(query, options) {
      const view = getView();
      return view ? textMatches(view.state.doc.toString(), query, options) : [];
    },
    reveal(match) {
      const view = getView();
      if (view) selectMatch(view, match);
    },
  });
}

function isBoundary(text: string, index: number): boolean {
  const character = text[index];
  return character === undefined || !/[\p{L}\p{N}_]/u.test(character);
}

function selectMatch(view: EditorView, match: { from: number; to: number }): void {
  view.dispatch({
    effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
    selection: { anchor: match.from, head: match.to },
  });
  view.focus();
}

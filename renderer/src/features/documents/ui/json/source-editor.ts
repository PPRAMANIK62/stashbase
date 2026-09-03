import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language';
import { Compartment, EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';

import type {
  DocumentFindController,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';

const jsonHighlightStyle = HighlightStyle.define([
  { class: 'cm-json-property', tag: tags.propertyName },
  { class: 'cm-json-string', tag: tags.string },
  { class: 'cm-json-boolean', tag: tags.bool },
  { class: 'cm-json-number', tag: tags.number },
  { class: 'cm-json-punctuation', tag: tags.punctuation },
  { class: 'cm-json-invalid', tag: tags.invalid },
]);

const invalidDecorations = EditorView.decorations.compute(['doc'], (state) => {
  const marks: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (!node.type.isError || state.doc.length === 0) return;
      const from = node.from < node.to ? node.from : Math.max(0, node.from - 1);
      const to = node.from < node.to ? node.to : Math.min(state.doc.length, node.from + 1);
      if (from < to) marks.push(Decoration.mark({ class: 'cm-json-invalid' }).range(from, to));
    },
  });
  return Decoration.set(marks, true);
});

const activeIndentDecorations = EditorView.decorations.compute(['doc', 'selection'], (state) => {
  const line = state.doc.lineAt(state.selection.main.head);
  const leadingWhitespace = line.text.match(/^[\t ]+/u)?.[0];
  if (!leadingWhitespace) return Decoration.set([]);
  let columns = 0;
  for (const character of leadingWhitespace) {
    columns += character === '\t' ? 2 - (columns % 2) : 1;
  }
  const depth = Math.floor(columns / 2);
  if (depth === 0) return Decoration.set([]);
  return Decoration.set([
    Decoration.line({
      attributes: { style: `--cm-indent-depth: ${depth}` },
      class: 'cm-activeIndent',
    }).range(line.from),
  ]);
});

const codeTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    fontSize: 'var(--fs-body, 13px)',
    height: '100%',
  },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-activeIndent::before': {
    backgroundImage:
      'repeating-linear-gradient(to right, transparent 0, transparent calc(2ch - 1px), color-mix(in oklab, var(--focus-ring) 42%, transparent) calc(2ch - 1px), color-mix(in oklab, var(--focus-ring) 42%, transparent) 2ch)',
    content: '""',
    inset: '0 auto 0 6px',
    pointerEvents: 'none',
    position: 'absolute',
    width: 'calc(var(--cm-indent-depth) * 2ch)',
  },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in oklab, var(--focus-ring) 18%, transparent)',
    boxShadow: 'inset 0 -1px var(--focus-ring)',
    color: 'inherit',
  },
  '&.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: 'var(--destructive-light)',
    color: 'var(--destructive)',
  },
  '.cm-content': {
    caretColor: 'var(--focus-ring)',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.55',
    padding: '12px 0 64px',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--focus-ring)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '0',
    color: 'var(--muted-foreground)',
  },
  '.cm-line': { padding: '0 6px', position: 'relative' },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '2.5ch',
    padding: '0 4px',
    textAlign: 'right',
  },
  '.cm-scroller': { fontFamily: 'inherit', overflow: 'auto' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--selected) !important' },
  '.cm-json-boolean': { color: 'var(--foreground)' },
  '.cm-json-invalid': {
    color: 'var(--destructive)',
    textDecoration: 'underline wavy var(--destructive)',
    textUnderlineOffset: '2px',
  },
  '.cm-json-number': { color: 'var(--foreground)' },
  '.cm-json-property': { color: 'var(--foreground)' },
  '.cm-json-punctuation': { color: 'var(--muted-foreground)' },
  '.cm-json-string': { color: 'var(--muted-foreground)' },
});

export interface JsonSourceEditorSession {
  applySourcePatch(next: string): void;
  destroy(): void;
  find: DocumentFindController;
  focus(): void;
  setReadOnly(readOnly: boolean): void;
}

export function createJsonSourceEditor(
  host: HTMLElement,
  options: { content: string; onChange(value: string): void; readOnly: boolean },
): JsonSourceEditorSession {
  const readOnly = new Compartment();
  let applyingExternal = false;
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: options.content,
      extensions: [
        lineNumbers(),
        history(),
        json(),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        indentOnInput(),
        closeBrackets(),
        bracketMatching(),
        syntaxHighlighting(jsonHighlightStyle),
        invalidDecorations,
        activeIndentDecorations,
        keymap.of([...closeBracketsKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        readOnly.of([
          EditorState.readOnly.of(options.readOnly),
          EditorView.editable.of(!options.readOnly),
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': 'JSON source editor',
          autocapitalize: 'off',
          spellcheck: 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || applyingExternal) return;
          options.onChange(update.state.doc.toString());
        }),
        codeTheme,
      ],
    }),
  });

  return {
    applySourcePatch(next) {
      const current = view.state.doc.toString();
      if (current === next) return;
      let from = 0;
      while (from < current.length && from < next.length && current[from] === next[from]) from += 1;
      let currentTo = current.length;
      let nextTo = next.length;
      while (currentTo > from && nextTo > from && current[currentTo - 1] === next[nextTo - 1]) {
        currentTo -= 1;
        nextTo -= 1;
      }
      applyingExternal = true;
      try {
        view.dispatch({ changes: { from, insert: next.slice(from, nextTo), to: currentTo } });
      } finally {
        applyingExternal = false;
      }
    },
    destroy() {
      view.destroy();
    },
    find: createJsonSourceFindController(() => view),
    focus() {
      view.focus();
    },
    setReadOnly(next) {
      view.dispatch({
        effects: readOnly.reconfigure([
          EditorState.readOnly.of(next),
          EditorView.editable.of(!next),
        ]),
      });
    },
  };
}

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

function createJsonSourceFindController(getView: () => EditorView | null): DocumentFindController {
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

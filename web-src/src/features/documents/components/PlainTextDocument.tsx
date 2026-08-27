import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import {
  useAppActions,
  useWorkspace,
  type FindController,
  type FindOptions,
  type MatchInfo,
} from '@/store/contexts/AppContext';

type LiveFindController = FindController & { refresh: () => MatchInfo };

export interface PlainTextEditorSession {
  view: EditorView;
  find: LiveFindController;
  setReadOnly: (readOnly: boolean) => void;
  replaceFromDisk: (content: string) => void;
  destroy: () => void;
}

export function toPlainTextEditorText(source: string): string {
  return source.replace(/\r\n?/gu, '\n');
}

/** Literal CodeMirror source surface: no Markdown parser, HTML renderer,
 * JSON language, or general-purpose syntax mode enters this component. */
export function createPlainTextEditor(host: HTMLElement, opts: {
  content: string;
  readOnly: boolean;
  onUserChange: () => void;
  onFindInfo: (info: MatchInfo) => void;
}): PlainTextEditorSession {
  const readOnly = new Compartment();
  let applyingExternal = false;
  let find: LiveFindController;
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: toPlainTextEditorText(opts.content),
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        readOnly.of([EditorState.readOnly.of(opts.readOnly), EditorView.editable.of(!opts.readOnly)]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (!applyingExternal) opts.onUserChange();
          queueMicrotask(() => opts.onFindInfo(find.refresh()));
        }),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--fg)' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
          '.cm-content': { padding: '20px 0 72px', caretColor: 'var(--focus-ring)' },
          '.cm-line': { padding: '0 20px' },
          '.cm-gutters': { backgroundColor: 'var(--pane)', color: 'var(--muted)', border: '0' },
          '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
          '&.cm-focused': { outline: 'none' },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
            backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)',
          },
        }),
      ],
    }),
  });
  view.contentDOM.setAttribute('aria-label', 'Plain text source');
  find = makePlainTextFindController(() => view);
  return {
    view,
    find,
    setReadOnly: (next) => view.dispatch({ effects: readOnly.reconfigure([
      EditorState.readOnly.of(next),
      EditorView.editable.of(!next),
    ]) }),
    replaceFromDisk: (next) => {
      const normalized = toPlainTextEditorText(next);
      if (view.state.doc.toString() === normalized) return;
      applyingExternal = true;
      try { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: normalized } }); }
      finally { applyingExternal = false; }
    },
    destroy: () => view.destroy(),
  };
}

export function PlainTextDocument({ tabId, content, readOnly, active }: {
  tabId: string;
  content: string;
  readOnly: boolean;
  active: boolean;
}) {
  const { activeTab } = useWorkspace();
  const { actions, dispatch } = useAppActions();
  const registerFindController = actions.registerFindController;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PlainTextEditorSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session = createPlainTextEditor(host, {
      content,
      readOnly,
      onUserChange: actions.scheduleSave,
      onFindInfo: (info) => dispatch({ type: 'FIND_SET', patch: info }),
    });
    sessionRef.current = session;
    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
      actions.registerEditor(null);
      registerFindController(null);
      session.destroy();
    };
    // One editor instance per active TXT tab preserves undo and selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.setReadOnly(readOnly);
    if (!readOnly && active) {
      actions.registerEditor({
        getValue: () => session.view.state.doc.toString(),
        focus: () => session.view.focus(),
      });
    } else {
      actions.registerEditor(null);
    }
  }, [actions, active, readOnly]);

  useEffect(() => {
    if (activeTab?.dirty) return;
    sessionRef.current?.replaceFromDisk(content);
  }, [activeTab?.dirty, content]);

  useEffect(() => {
    const controller = sessionRef.current?.find;
    if (!active || !controller) return;
    registerFindController(controller);
    return () => registerFindController(null);
  }, [active, registerFindController]);

  const pendingHighlight = activeTab?.pendingHighlight ?? null;
  useEffect(() => {
    const view = sessionRef.current?.view;
    if (!view || !pendingHighlight?.chunkText) return;
    const from = view.state.doc.toString().indexOf(pendingHighlight.chunkText);
    if (from < 0) return;
    selectMatch(view, from, from + pendingHighlight.chunkText.length);
    actions.consumePendingHighlight();
  }, [actions, pendingHighlight]);

  return (
    <div className="plain-text-document min-h-0 overflow-hidden" data-tab-id={tabId} role="region" aria-label="Plain text document" hidden={!active}>
      <div ref={hostRef} className="h-full" />
    </div>
  );
}

export function makePlainTextFindController(getView: () => EditorView | null): LiveFindController {
  let matches: Array<{ from: number; to: number }> = [];
  let current = -1;
  let query = '';
  let options: FindOptions = { wholeWord: false, caseSensitive: false };
  const info = (): MatchInfo => ({ current: matches.length ? current + 1 : 0, total: matches.length });
  const move = (delta: number): MatchInfo => {
    const view = getView();
    if (!view || matches.length === 0) return info();
    current = (current + delta + matches.length) % matches.length;
    selectMatch(view, matches[current].from, matches[current].to);
    return info();
  };
  const setQuery = (next: string, opts: FindOptions): MatchInfo => {
    query = next;
    options = opts;
    const view = getView();
    matches = view ? textMatches(view.state.doc.toString(), query, options) : [];
    current = matches.length ? 0 : -1;
    if (view && current >= 0) selectMatch(view, matches[current].from, matches[current].to);
    return info();
  };
  const refresh = (): MatchInfo => {
    const view = getView();
    if (!view) { matches = []; current = -1; return info(); }
    const cursor = view.state.selection.main.from;
    matches = textMatches(view.state.doc.toString(), query, options);
    if (matches.length === 0) current = -1;
    else {
      const next = matches.findIndex((match) => match.from >= cursor);
      current = next >= 0 ? next : 0;
    }
    return info();
  };
  return {
    setQuery,
    restoreQuery: setQuery,
    next: () => move(1),
    prev: () => move(-1),
    close: () => { matches = []; current = -1; query = ''; },
    refresh,
  };
}

function textMatches(text: string, query: string, opts: FindOptions): Array<{ from: number; to: number }> {
  if (!query) return [];
  const haystack = opts.caseSensitive ? text : text.toLocaleLowerCase();
  const needle = opts.caseSensitive ? query : query.toLocaleLowerCase();
  const matches: Array<{ from: number; to: number }> = [];
  for (let offset = 0; offset <= haystack.length - needle.length;) {
    const from = haystack.indexOf(needle, offset);
    if (from < 0) break;
    const to = from + needle.length;
    if (!opts.wholeWord || (isBoundary(text, from - 1) && isBoundary(text, to))) matches.push({ from, to });
    offset = Math.max(to, from + 1);
  }
  return matches;
}

function isBoundary(text: string, index: number): boolean {
  return index < 0 || index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);
}

function selectMatch(view: EditorView, from: number, to: number): void {
  if (from < 0 || to < from || to > view.state.doc.length) return;
  view.dispatch({
    selection: { anchor: from, head: to },
    effects: EditorView.scrollIntoView(from, { y: 'center' }),
  });
}

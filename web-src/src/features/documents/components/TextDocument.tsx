import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { useAppActions, useWorkspace, type FindController, type FindOptions, type MatchInfo } from '@/store/contexts/AppContext';
import { loadCodeLanguage, stashbaseCodeSurface } from '@/features/documents/lib/codeSurface';

type TextLineEnding = 'crlf' | 'cr' | 'lf';
type LiveFindController = FindController & { refresh: () => MatchInfo };

function lineEndingFor(source: string): TextLineEnding {
  if (source.includes('\r\n')) return 'crlf';
  return source.includes('\r') ? 'cr' : 'lf';
}

export function toTextEditorText(source: string): string {
  return source.replace(/\r\n?/gu, '\n');
}

export function fromTextEditorText(source: string, lineEnding: TextLineEnding): string {
  if (lineEnding === 'lf') return source;
  return source.replace(/\n/gu, lineEnding === 'crlf' ? '\r\n' : '\r');
}

export interface TextEditorSession {
  view: EditorView;
  find: LiveFindController;
  setReadOnly: (readOnly: boolean) => void;
  replaceFromDisk: (content: string) => void;
  destroy: () => void;
}

export function createTextEditor(host: HTMLElement, opts: {
  content: string;
  readOnly: boolean;
  /** Drives syntax highlighting. Omitted (or unrecognised) renders as
   *  uncoloured monospace rather than guessing a grammar. */
  fileName?: string;
  onUserChange: () => void;
  onFindInfo: (info: MatchInfo) => void;
}): TextEditorSession {
  const readOnly = new Compartment();
  // Starts empty and is filled once the grammar resolves, so the file is
  // readable on the first frame instead of waiting on a network chunk.
  const language = new Compartment();
  let applyingExternal = false;
  let destroyed = false;
  let find: LiveFindController;
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: toTextEditorText(opts.content),
      extensions: [
        lineNumbers(),
        history(),
        language.of([]),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        readOnly.of([EditorState.readOnly.of(opts.readOnly), EditorView.editable.of(!opts.readOnly)]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (!applyingExternal) opts.onUserChange();
          queueMicrotask(() => opts.onFindInfo(find.refresh()));
        }),
        stashbaseCodeSurface,
      ],
    }),
  });
  void loadCodeLanguage(view, language, opts.fileName, () => !destroyed);
  find = makeTextFindController(() => view);
  return {
    view,
    find,
    setReadOnly: (next) => view.dispatch({ effects: readOnly.reconfigure([
      EditorState.readOnly.of(next), EditorView.editable.of(!next),
    ]) }),
    replaceFromDisk: (next) => {
      const normalized = toTextEditorText(next);
      if (view.state.doc.toString() === normalized) return;
      applyingExternal = true;
      try { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: normalized } }); }
      finally { applyingExternal = false; }
    },
    destroy: () => { destroyed = true; view.destroy(); },
  };
}

export function TextDocument({ tabId, content, readOnly, active, fileName }: {
  tabId: string;
  content: string;
  readOnly: boolean;
  active: boolean;
  fileName?: string;
}) {
  const { activeTab } = useWorkspace();
  const { actions, dispatch } = useAppActions();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<TextEditorSession | null>(null);
  const lineEndingRef = useRef(lineEndingFor(content));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session = createTextEditor(host, {
      content,
      readOnly,
      fileName,
      onUserChange: actions.scheduleSave,
      onFindInfo: (info) => dispatch({ type: 'FIND_SET', patch: info }),
    });
    sessionRef.current = session;
    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
      actions.registerEditor(null);
      actions.registerFindController(null);
      session.destroy();
    };
    // One editor instance per open tab preserves selection and undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.setReadOnly(readOnly);
    if (!readOnly && active) {
      actions.registerEditor({
        getValue: () => fromTextEditorText(session.view.state.doc.toString(), lineEndingRef.current),
        focus: () => session.view.focus(),
      });
    } else {
      actions.registerEditor(null);
    }
    if (active) actions.registerFindController(session.find);
    return () => {
      actions.registerEditor(null);
      actions.registerFindController(null);
    };
  }, [actions, active, readOnly]);

  useEffect(() => {
    if (activeTab?.dirty) return;
    lineEndingRef.current = lineEndingFor(content);
    sessionRef.current?.replaceFromDisk(content);
  }, [activeTab?.dirty, content]);

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
    <div
      ref={hostRef}
      className="h-full min-h-0 overflow-hidden bg-pane"
      data-tab-id={tabId}
      role="region"
      aria-label={readOnly ? 'Read-only text document' : 'Text document'}
      hidden={!active}
    />
  );
}

export function makeTextFindController(getView: () => EditorView | null): LiveFindController {
  let matches: Array<{ from: number; to: number }> = [];
  let current = -1;
  let query = '';
  let options: FindOptions = { wholeWord: false, caseSensitive: false };
  const info = (): MatchInfo => ({ current: matches.length ? current + 1 : 0, total: matches.length });
  const collect = () => {
    const view = getView();
    matches = view ? textMatches(view.state.doc.toString(), query, options) : [];
    if (matches.length === 0) current = -1;
    else if (current < 0 || current >= matches.length) current = 0;
  };
  const move = (delta: number) => {
    collect();
    const view = getView();
    if (!view || matches.length === 0) return info();
    current = (current + delta + matches.length) % matches.length;
    selectMatch(view, matches[current].from, matches[current].to);
    return info();
  };
  const setQuery = (next: string, nextOptions: FindOptions) => {
    query = next;
    options = nextOptions;
    current = 0;
    collect();
    const view = getView();
    if (view && current >= 0) selectMatch(view, matches[current].from, matches[current].to);
    return info();
  };
  return {
    setQuery,
    restoreQuery: setQuery,
    next: () => move(1),
    prev: () => move(-1),
    close: () => { matches = []; current = -1; query = ''; },
    refresh: () => { collect(); return info(); },
  };
}

export function textMatches(text: string, query: string, opts: FindOptions): Array<{ from: number; to: number }> {
  if (!query) return [];
  const haystack = opts.caseSensitive ? text : text.toLocaleLowerCase();
  const needle = opts.caseSensitive ? query : query.toLocaleLowerCase();
  const out: Array<{ from: number; to: number }> = [];
  for (let from = 0; from <= haystack.length - needle.length;) {
    const hit = haystack.indexOf(needle, from);
    if (hit < 0) break;
    const end = hit + needle.length;
    if (!opts.wholeWord || (isBoundary(text, hit - 1) && isBoundary(text, end))) out.push({ from: hit, to: end });
    from = Math.max(end, hit + 1);
  }
  return out;
}

function isBoundary(text: string, index: number): boolean {
  return index < 0 || index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);
}

function selectMatch(view: EditorView, from: number, to: number): void {
  if (from < 0 || to < from || to > view.state.doc.length) return;
  view.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: 'center' }) });
}

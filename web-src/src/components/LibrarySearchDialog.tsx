import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { api, errorMessage, type KeywordMatch, type LibraryKeywordFile } from '../api';
import type { PendingHighlight } from '../store/state';
import { useApp } from '../store/AppContext';
import { openSettings } from './SettingsModal';
import { guiSemanticVisibleCount } from '../store/appContextHelpers';
import { relevanceRatios } from '../lib/searchRelevance';
import { searchSnippetText } from '../lib/searchSnippet';
import { folderRefsEqual } from '../folderPath';
import {
  applyLibrarySearchPrefill,
  folderBasename,
  orderKeywordFiles,
  readLibrarySearchMemory,
  resolveSemanticHits,
  subfolderScopes,
  writeLibrarySearchMemory,
  type LibrarySearchMode,
  type LibrarySearchPrefill,
  type LibrarySearchScope,
  type LibrarySemanticHit,
} from '../librarySearch';
import { Button } from './ui/button';
import {
  Menu, MenuItem, MenuPopup, MenuPortal, MenuPositioner, MenuTrigger,
} from './ui/menu';
import { StatusMessage } from './ui/status';
import { CheckIcon, ChevronDownIcon } from '../icons';
import { cn } from '../lib/utils';
import {
  menuSectionClass, optActiveClass, pillChevronClass, pillClass,
} from './agent/panelStyles';
import { SemanticIndexingNotice } from './SemanticIndexingNotice';
import { PICKER_VEIL_CLASS, pickerPanelClass } from './pickerChrome';

/**
 * The library search popup — the app's one search surface. A palette-style
 * modal (Quick Open chrome) over the WHOLE library by default, narrowable to
 * the active folder or one of its subfolders. Query, mode, toggles, scope,
 * and results live in module memory (`librarySearch.ts`), never in the
 * reducer, so the popup survives close/reopen and folder switches.
 *
 * Opening a result NEVER switches the window's folder: a hit in the active
 * folder opens normally; a hit in another member folder opens as an
 * out-of-folder read-only tab (`actions.openLibraryFile`), which carries its
 * own "open that folder in a new window" affordance in the document banner.
 * Only from the no-folder workspace does a pick bind the folder — there is
 * no context to preserve there.
 */

/** Latch buttons (the ≈ Similar mode toggle, Aa / Word) — quiet until
 *  pressed, then the accent state ladder driven off aria-pressed. */
const MODE_TOGGLE_CLASS =
  'h-5 min-w-5.5 rounded-sm px-1 text-xs font-normal text-muted-foreground aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent';

const HIT_LIST_CLASS = 'px-1.5 py-1';
const HIT_SUMMARY_CLASS = 'px-2.5 pt-0.5 pb-1.5 text-xs text-muted-foreground';

/** Sentinel kept out of user-facing copy: rendering special-cases the
 *  missing-embedding-key state instead of showing a raw error line. */
const EMBEDDER_KEY_ERROR = 'embedder-key-required';

const SEMANTIC_SEARCH_CANDIDATES = 30;
const SEMANTIC_SHOW_MORE_STEP = 8;

type ResultEntry =
  | { kind: 'semantic'; hit: LibrarySemanticHit; relevance?: number }
  | { kind: 'more' }
  | { kind: 'file'; file: LibraryKeywordFile }
  | { kind: 'match'; file: LibraryKeywordFile; match: KeywordMatch };

interface RowProps {
  id: string;
  role: 'option';
  'aria-selected': boolean;
  onMouseMove: () => void;
  onMouseDown: (event: ReactMouseEvent) => void;
}

export default function LibrarySearchDialog({ prefill, onClose }: {
  prefill?: LibrarySearchPrefill | null;
  onClose: () => void;
}) {
  const { state, actions, dispatch } = useApp();
  const initial = useRef(applyLibrarySearchPrefill(readLibrarySearchMemory(), prefill)).current;
  const [query, setQuery] = useState(initial.query);
  const [mode, setMode] = useState<LibrarySearchMode>(initial.mode);
  const [caseStrict, setCaseStrict] = useState(initial.caseStrict);
  const [wholeWord, setWholeWord] = useState(initial.wholeWord);
  const [scope, setScope] = useState<LibrarySearchScope>(initial.scope);
  const [semanticHits, setSemanticHits] = useState(initial.semanticHits);
  const [keywordResult, setKeywordResult] = useState(initial.keywordResult);
  const [error, setError] = useState(initial.error);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [visibleSemantic, setVisibleSemantic] = useState(() =>
    initial.semanticHits ? guiSemanticVisibleCount(initial.semanticHits) : 0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const folderPathRef = useRef(state.folderPath);
  folderPathRef.current = state.folderPath;
  const folderRootsRef = useRef<string[]>([]);
  folderRootsRef.current = useMemo(() => {
    const roots = state.recent.map((entry) => entry.path);
    if (state.folderPath && !roots.some((root) => folderRefsEqual(root, state.folderPath))) {
      roots.push(state.folderPath);
    }
    return roots;
  }, [state.recent, state.folderPath]);
  const hasLibrary = folderRootsRef.current.length > 0;

  // Every state change lands in module memory so close/reopen — and any
  // folder switch while the popup is away — restore it exactly.
  useEffect(() => {
    writeLibrarySearchMemory({ query, mode, caseStrict, wholeWord, scope, semanticHits, keywordResult, error });
  }, [query, mode, caseStrict, wholeWord, scope, semanticHits, keywordResult, error]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, []);

  interface RunOpts {
    query: string;
    mode: LibrarySearchMode;
    caseStrict: boolean;
    wholeWord: boolean;
    scope: LibrarySearchScope;
    /** Background refresh: keep the user's Show-more disclosure instead of
     *  collapsing back to the relevance knee. */
    preserveDisclosure?: boolean;
  }

  const runSearch = useCallback(async (opts: RunOpts) => {
    const myGen = ++generation.current;
    const q = opts.query.trim();
    if (!q) {
      setSemanticHits(null);
      setKeywordResult(null);
      setError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const stale = () => myGen !== generation.current;
    // Folder scope means the folder active right now; with no folder open it
    // gracefully widens to the library (the copy and pill say so).
    const folderPath = folderPathRef.current;
    const folderScope = opts.scope.kind === 'folder' && folderPath
      ? {
          folder: folderPath,
          ...(opts.scope.subfolder ? { pathPrefix: `${folderPath}/${opts.scope.subfolder}` } : {}),
        }
      : {};
    try {
      if (opts.mode === 'keyword') {
        const result = await api.libraryKeywordSearch(q, {
          caseStrict: opts.caseStrict,
          wholeWord: opts.wholeWord,
          ...folderScope,
        });
        if (stale()) return;
        setKeywordResult(result);
        setSemanticHits(null);
        setError(null);
      } else {
        const embedder = await api.getEmbedder();
        if (stale()) return;
        dispatch({ type: 'EMBEDDER_KEY_STATE', hasKey: embedder.hasKey });
        if (!embedder.hasKey) {
          setError(EMBEDDER_KEY_ERROR);
          setSemanticHits(null);
          setSearching(false);
          return;
        }
        const { hits } = await api.librarySearch(q, SEMANTIC_SEARCH_CANDIDATES, folderScope);
        if (stale()) return;
        const resolved = resolveSemanticHits(hits, folderRootsRef.current);
        setSemanticHits(resolved);
        setVisibleSemantic((current) => opts.preserveDisclosure
          ? Math.max(guiSemanticVisibleCount(resolved), Math.min(current, resolved.length))
          : guiSemanticVisibleCount(resolved));
        setKeywordResult(null);
        setError(null);
      }
      setSearching(false);
    } catch (err) {
      if (stale()) return;
      const message = errorMessage(err);
      console.warn(`[library-search:${opts.mode}] failed:`, message);
      setError(message);
      setSearching(false);
    }
  }, [dispatch]);

  // Keep results fresh against current content: fires on mount (a reopened
  // popup silently refreshes its remembered results) and whenever a note
  // lands or a conversion finishes while the popup stays open. Old results
  // stay visible until the fresh response arrives, so this never flashes.
  useEffect(() => {
    if (query.trim()) void runSearch({ query, mode, caseStrict, wholeWord, scope, preserveDisclosure: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.files, state.pendingConversions]);

  /** Cancel a pending keystroke debounce — every immediate run must win
   *  over it, or the debounce would later re-run with stale options. */
  function cancelDebounce() {
    if (debounce.current) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setActive(0);
    cancelDebounce();
    if (!value.trim()) {
      void runSearch({ query: '', mode, caseStrict, wholeWord, scope });
      return;
    }
    debounce.current = setTimeout(() => {
      debounce.current = null;
      void runSearch({ query: value, mode, caseStrict, wholeWord, scope });
    }, 250);
  }

  function rerun(next: Partial<RunOpts>) {
    cancelDebounce();
    if (query.trim()) void runSearch({ query, mode, caseStrict, wholeWord, scope, ...next });
  }

  function setSearchMode(next: LibrarySearchMode) {
    setMode(next);
    setActive(0);
    rerun({ mode: next });
  }

  function toggleCaseStrict() {
    const next = !caseStrict;
    setCaseStrict(next);
    rerun({ caseStrict: next });
  }

  function toggleWholeWord() {
    const next = !wholeWord;
    setWholeWord(next);
    rerun({ wholeWord: next });
  }

  function setSearchScope(next: LibrarySearchScope) {
    setScope(next);
    setActive(0);
    rerun({ scope: next });
  }

  const activeFolderPath = state.folderPath;
  // A remembered folder scope with no folder open runs library-wide; every
  // copy below keys off the EFFECTIVE scope so the UI never claims a folder
  // narrowing that is not happening.
  const effectiveFolderScope = scope.kind === 'folder' && Boolean(activeFolderPath);
  const librarySpansFolders = folderRootsRef.current.length > 1;

  // One flat entry list drives keyboard navigation, aria ids, and click
  // handling; the render below walks the same structures in the same order.
  const { entries, semanticView, keywordGroups } = useMemo(() => {
    const entries: ResultEntry[] = [];
    if (mode === 'semantic' && semanticHits) {
      const ratios = relevanceRatios(semanticHits.map((hit) => hit.score));
      const shown = Math.min(visibleSemantic, semanticHits.length);
      const rows = semanticHits.slice(0, shown).map((hit, i) => {
        entries.push({ kind: 'semantic', hit, relevance: ratios[i] });
        return { hit, relevance: ratios[i], index: entries.length - 1 };
      });
      const remaining = semanticHits.length - shown;
      let moreIndex: number | null = null;
      if (remaining > 0) {
        entries.push({ kind: 'more' });
        moreIndex = entries.length - 1;
      }
      return {
        entries,
        semanticView: { rows, remaining, moreIndex, shown, total: semanticHits.length },
        keywordGroups: [],
      };
    }
    if (mode === 'keyword' && keywordResult) {
      const groups = orderKeywordFiles(keywordResult.files, activeFolderPath).map((file) => {
        entries.push({ kind: 'file', file });
        const fileIndex = entries.length - 1;
        const matches = file.matches.map((match) => {
          entries.push({ kind: 'match', file, match });
          return { match, index: entries.length - 1 };
        });
        return { file, index: fileIndex, matches, hiddenCount: file.totalMatches - file.matches.length };
      });
      return { entries, semanticView: null, keywordGroups: groups };
    }
    return { entries, semanticView: null, keywordGroups: [] };
  }, [mode, semanticHits, keywordResult, visibleSemantic, activeFolderPath]);

  useEffect(() => {
    if (active >= entries.length) setActive(Math.max(0, entries.length - 1));
  }, [active, entries.length]);

  useEffect(() => {
    document.getElementById(`library-search-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = onClose;

  /** Open one result WITHOUT switching the window's folder: same-folder
   *  hits go through normal selection, cross-folder hits open an
   *  out-of-folder read-only tab. Only the no-folder workspace binds the
   *  folder first — there is no context to preserve there. */
  function openTarget(folder: string, rel: string, hit: PendingHighlight) {
    close();
    const current = folderPathRef.current;
    if (!current) {
      void actions.openFolder(folder)
        .then(() => {
          // A superseding open may have won the race — never select into
          // whatever folder happens to be current now.
          if (!folderRefsEqual(folderPathRef.current, folder)) return;
          return actions.selectFileWithHighlight(rel, hit).then(() => revealAncestors(rel));
        })
        .catch((err: unknown) => {
          actions.toast(`Could not open ${folderBasename(folder)}: ${errorMessage(err)}`, { level: 'error' });
        });
      return;
    }
    const sameFolder = folderRefsEqual(folder, current);
    void actions.openLibraryFile(folder, rel, { hit }).then(() => {
      if (sameFolder) revealAncestors(rel);
    });
  }

  /** The tree keeps ancestors collapsed after switches; expand the opened
   *  file's chain so its selected row is actually visible. Active-folder
   *  targets only — the tree does not show other folders. */
  function revealAncestors(rel: string) {
    const parts = rel.split('/');
    for (let i = 1; i < parts.length; i++) {
      dispatch({ type: 'EXPAND_FOLDER', path: parts.slice(0, i).join('/') });
    }
  }

  function keywordHighlight(match: KeywordMatch | undefined): PendingHighlight {
    return {
      startLine: match?.line,
      chunkText: query.trim(),
      audioSeekText: match?.text,
      audioSeekMs: match?.audioTimestampMs,
      openFindBar: true,
      findCaseStrict: caseStrict,
      findWholeWord: wholeWord,
      pdfPage: match?.pdfPage,
    };
  }

  function activateEntry(entry: ResultEntry) {
    switch (entry.kind) {
      case 'semantic':
        openTarget(entry.hit.folder, entry.hit.rel, {
          startLine: entry.hit.startLine,
          endLine: entry.hit.endLine,
          chunkText: entry.hit.content,
          pdfPage: entry.hit.pdfPage,
        });
        break;
      case 'file':
        openTarget(entry.file.folder, entry.file.path, keywordHighlight(entry.file.matches[0]));
        break;
      case 'match':
        openTarget(entry.file.folder, entry.file.path, keywordHighlight(entry.match));
        break;
      case 'more':
        setVisibleSemantic((current) => current + SEMANTIC_SHOW_MORE_STEP);
        break;
    }
  }

  const rowProps = (index: number): RowProps => ({
    id: `library-search-${index}`,
    role: 'option',
    'aria-selected': index === active,
    onMouseMove: () => setActive(index),
    onMouseDown: (event) => {
      event.preventDefault();
      activateEntry(entries[index]);
    },
  });

  const isKeyword = mode === 'keyword';
  const scopes = subfolderScopes(state.files);
  const trimmedQuery = query.trim();

  return (
    <div
      className={`library-search-veil quick-open-blocking ${PICKER_VEIL_CLASS}`}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
      // Escape must dismiss from ANY focus inside the popup — the mode
      // toggles, scope pill, and banner buttons are all focusable.
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className={cn(pickerPanelClass('wide'), 'flex flex-col')} role="dialog" aria-modal="true" aria-label="Search library">
        <input
          ref={inputRef}
          className="w-full border-0 border-b border-solid border-border bg-transparent px-3.75 py-3.25 [font-family:inherit] text-xl text-foreground outline-0 placeholder:text-muted-foreground"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="library-search-results"
          aria-expanded="true"
          aria-activedescendant={entries.length ? `library-search-${active}` : undefined}
          placeholder="Search notes, PDFs, images, and media transcripts"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, Math.max(0, entries.length - 1))); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
            else if (event.key === 'Home' && !query) { event.preventDefault(); setActive(0); }
            else if (event.key === 'End' && !query) { event.preventDefault(); setActive(Math.max(0, entries.length - 1)); }
            else if (event.key === 'Enter' && entries[active]) { event.preventDefault(); activateEntry(entries[active]); }
          }}
        />
        {/* Mode is ONE state-showing toggle: lit `≈ Similar` (default)
          * searches by meaning, quiet `= Exact` matches literal text, with
          * Aa / Word latches beside it in exact mode. The scope pill closes
          * the row — All folders by default, narrowable to the active
          * folder or one of its subfolders. */}
        <div className="flex items-center gap-1 px-3 py-2">
          <Button
            variant="ghost"
            size="xs"
            className={MODE_TOGGLE_CLASS + ' px-1.5'}
            aria-label="Search by similarity"
            aria-pressed={!isKeyword}
            title={isKeyword
              ? 'Matching exact text — click to search by meaning'
              : state.embedderHasKey === false
                ? 'Matching by meaning — needs embedding setup'
                : 'Matching by meaning — click to match exact text'}
            onClick={() => setSearchMode(isKeyword ? 'semantic' : 'keyword')}
          >
            {isKeyword ? '= Exact' : '≈ Similar'}
          </Button>
          {isKeyword && (
            <div className="flex items-center gap-0.5" role="group" aria-label="Keyword options">
              <Button variant="ghost" size="xs" className={MODE_TOGGLE_CLASS} onClick={toggleCaseStrict} aria-label="Match case" aria-pressed={caseStrict} title="Match Case">
                Aa
              </Button>
              <Button variant="ghost" size="xs" className={MODE_TOGGLE_CLASS + ' min-w-8.5'} onClick={toggleWholeWord} aria-label="Match whole word" aria-pressed={wholeWord} title="Whole word">
                Word
              </Button>
            </div>
          )}
          <ScopePill
            scope={scope}
            folderName={state.folder}
            hasFolder={Boolean(state.folderPath)}
            scopes={scopes}
            onPick={setSearchScope}
          />
        </div>
        <SemanticIndexingNotice />
        <SearchStatusBanner semanticMode={!isKeyword} onNavigateAway={close} />
        <div id="library-search-results" role="listbox" aria-label="Search results" className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {!hasLibrary ? (
            <div className="empty-list">
              <div>Your library has no folders yet.</div>
              <div>Add a folder from the sidebar to make it searchable.</div>
            </div>
          ) : !trimmedQuery ? (
            <p className="m-0 px-3.5 pt-1 pb-3 text-xs text-muted-foreground">
              {effectiveFolderScope ? 'Searches the current folder.' : 'Searches every folder in your library.'}
            </p>
          ) : error === EMBEDDER_KEY_ERROR || (error && error.startsWith('semantic search is disabled')) ? (
            <div className="empty-list">
              <div>Similarity search needs an embedding API key.</div>
              <div>Exact text search works without embeddings.</div>
            </div>
          ) : error ? (
            <div className="empty-list">Search failed: {error}</div>
          ) : isKeyword ? (
            searching && !keywordResult ? (
              <div className="empty-list">Searching…</div>
            ) : !keywordResult || keywordResult.files.length === 0 ? (
              <div className="empty-list">No matches</div>
            ) : (
              <div className={HIT_LIST_CLASS}>
                <div className={HIT_SUMMARY_CLASS}>
                  {keywordResult.totalMatches} match{keywordResult.totalMatches === 1 ? '' : 'es'} in {keywordResult.files.length} file{keywordResult.files.length === 1 ? '' : 's'}
                  {keywordResult.truncated && ' (truncated)'}
                </div>
                {keywordGroups.map((group) => (
                  <div className="mb-1.5" key={`${group.file.folder}::${group.file.path}`}>
                    <div
                      className={cn(
                        'flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 hover:bg-muted',
                        group.index === active && 'bg-muted',
                      )}
                      title={`${group.file.folder}/${group.file.path}`}
                      {...rowProps(group.index)}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {group.file.path.split('/').pop() ?? group.file.path}
                      </span>
                      {librarySpansFolders && !folderRefsEqualSafe(group.file.folder, activeFolderPath) && (
                        <span className="max-w-32 shrink-0 truncate text-xs text-muted-foreground">{folderBasename(group.file.folder)}</span>
                      )}
                      <span className="min-w-4 shrink-0 rounded-lg bg-muted px-1.25 text-center text-2xs leading-4 text-muted-foreground">{group.file.totalMatches}</span>
                    </div>
                    {group.matches.map(({ match, index }) => (
                      <div
                        key={`${match.line}#${index}`}
                        className={cn(
                          'flex cursor-pointer items-baseline gap-2 rounded-sm py-0.5 pr-2.5 pl-4 text-sm leading-normal hover:bg-muted',
                          index === active && 'bg-muted',
                        )}
                        title={`Line ${match.line}`}
                        {...rowProps(index)}
                      >
                        <span className="min-w-6.5 shrink-0 text-right text-muted-foreground tabular-nums select-none">{match.line}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground [&_mark]:rounded-xs [&_mark]:bg-accent-amber/30 [&_mark]:px-px [&_mark]:text-inherit">
                          {highlightRanges(match.text, match.ranges)}
                        </span>
                      </div>
                    ))}
                    {group.hiddenCount > 0 && (
                      <div className="cursor-default py-0.5 pr-2.5 pl-4 text-xs text-muted-foreground">+ {group.hiddenCount} more in this file</div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : searching && !semanticHits ? (
            <div className="empty-list">Searching…</div>
          ) : !semanticView || semanticView.total === 0 ? (
            <div className="empty-list">No matches</div>
          ) : (
            <div className={HIT_LIST_CLASS}>
              <div className={HIT_SUMMARY_CLASS}>
                {semanticView.remaining > 0
                  ? `${semanticView.shown} of ${semanticView.total} results`
                  : `${semanticView.total} result${semanticView.total === 1 ? '' : 's'}`}
              </div>
              {semanticView.rows.map(({ hit, relevance, index }) => (
                <SemanticHitRow
                  key={`${hit.fileName}#${hit.chunkIndex}#${index}`}
                  hit={hit}
                  relevance={relevance}
                  isActive={index === active}
                  showFolder={librarySpansFolders && !folderRefsEqualSafe(hit.folder, activeFolderPath)}
                  rowProps={rowProps(index)}
                />
              ))}
              {semanticView.moreIndex != null && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'mt-0.5 mb-1 w-full font-normal text-accent',
                    semanticView.moreIndex === active && 'bg-muted',
                  )}
                  {...rowProps(semanticView.moreIndex)}
                >
                  Show {Math.min(semanticView.remaining, SEMANTIC_SHOW_MORE_STEP)} more
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function folderRefsEqualSafe(a: string, b: string): boolean {
  return Boolean(a) && Boolean(b) && folderRefsEqual(a, b);
}

function SemanticHitRow({ hit, relevance, isActive, showFolder, rowProps }: {
  hit: LibrarySemanticHit;
  relevance?: number;
  isActive: boolean;
  showFolder: boolean;
  rowProps: RowProps;
}) {
  const fileBasename = hit.rel.split('/').pop() ?? hit.rel;
  // No term highlighting on semantic snippets: a semantic hit isn't a literal
  // substring match, so marking the query words would mislead. Any leading
  // YAML frontmatter is stripped for DISPLAY only — `hit.content` stays raw
  // because it anchors click-through navigation.
  const snippetSource = searchSnippetText(hit.content);
  const snippet = snippetSource.length > 240 ? snippetSource.slice(0, 240) + '…' : snippetSource;
  const relevanceLabel = relevance != null
    ? `Relative match strength: ${Math.round(relevance * 100)}%`
    : undefined;
  return (
    <div
      className={cn(
        'mb-1 cursor-pointer rounded-md border border-transparent px-2.5 py-2 hover:border-border hover:bg-muted',
        isActive && 'border-border bg-muted',
      )}
      title={hit.fileName}
      {...rowProps}
    >
      {hit.heading && <div className="mb-1 truncate text-xs font-medium tracking-wide text-muted-foreground">{hit.heading}</div>}
      <div className="line-clamp-3 text-sm text-foreground">{snippet}</div>
      <div className="mt-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {fileBasename}
          {showFolder && <span className="opacity-80"> · {folderBasename(hit.folder)}</span>}
        </span>
        {relevance != null && (
          <span
            className="ml-2 h-1 w-11 shrink-0 overflow-hidden rounded-xs bg-accent/15"
            role="img"
            aria-label={relevanceLabel}
            title={relevanceLabel}
          >
            <span className="block h-full rounded-xs bg-accent" style={{ width: `${Math.round(relevance * 100)}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Scope pill — All folders (default) / the active folder / one of its
 *  subfolders. Hidden when no folder is open (nothing to narrow to). */
function ScopePill({ scope, folderName, hasFolder, scopes, onPick }: {
  scope: LibrarySearchScope;
  folderName: string;
  hasFolder: boolean;
  scopes: string[];
  onPick: (scope: LibrarySearchScope) => void;
}) {
  if (!hasFolder) return null;
  const subfolder = scope.kind === 'folder' ? scope.subfolder : null;
  const staleSubfolder = subfolder != null && !scopes.includes(subfolder);
  const label = scope.kind === 'library'
    ? 'All folders'
    : subfolder
      ? lastSegment(subfolder)
      : folderName || 'This folder';
  return (
    <Menu>
      <MenuTrigger
        className={cn(pillClass, 'ml-auto min-w-0')}
        aria-label="Search scope"
        title={scope.kind === 'library'
          ? 'Searching every folder — click to narrow'
          : subfolder
            ? `Search scope — ${subfolder}`
            : `Searching ${folderName || 'this folder'}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className={pillChevronClass} />
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side="bottom" align="end" sideOffset={4} collisionPadding={8}>
          <MenuPopup className="max-h-[min(320px,50vh)] w-58 max-w-[calc(100vw-24px)] overflow-auto p-1 text-sm" aria-label="Search scope">
            <ScopeRow
              title="All folders"
              tooltip="Search everything in your library"
              active={scope.kind === 'library'}
              onPick={() => onPick({ kind: 'library' })}
            />
            <ScopeRow
              title={folderName || 'This folder'}
              tooltip="Search the current folder"
              active={scope.kind === 'folder' && subfolder == null}
              onPick={() => onPick({ kind: 'folder', subfolder: null })}
            />
            {(scopes.length > 0 || staleSubfolder) && <div className={menuSectionClass}>Subfolders</div>}
            {staleSubfolder && (
              <ScopeRow
                title={lastSegment(subfolder)}
                tooltip={subfolder}
                depth={scopeDepth(subfolder)}
                active
                onPick={() => onPick({ kind: 'folder', subfolder })}
              />
            )}
            {scopes.map((candidate) => (
              <ScopeRow
                key={candidate}
                title={lastSegment(candidate)}
                tooltip={candidate}
                depth={scopeDepth(candidate)}
                active={subfolder === candidate}
                onPick={() => onPick({ kind: 'folder', subfolder: candidate })}
              />
            ))}
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  );
}

/** One scope option — a single 28px line. Hierarchy is indentation (14px per
 *  level, no guides — document-tool idiom), the full path is the tooltip,
 *  and the active row is the neutral selected surface with a trailing accent
 *  check. */
function ScopeRow({ title, tooltip, active, depth = 0, onPick }: {
  title: string;
  tooltip?: string;
  active: boolean;
  depth?: number;
  onPick: () => void;
}) {
  return (
    <MenuItem
      onClick={onPick}
      title={tooltip}
      className={cn('h-7 gap-2 py-0', active && optActiveClass)}
      style={depth > 0 ? { paddingLeft: `${8 + depth * 14}px` } : undefined}
    >
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {active && <CheckIcon className="size-3.5 shrink-0 text-accent" />}
    </MenuItem>
  );
}

function lastSegment(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] || path;
}

/** Nesting depth of a folder-relative scope path ("a/b/c" → 2). */
function scopeDepth(scope: string): number {
  return scope.split('/').length - 1;
}

/** One readiness/problem banner: title + detail copy on the left, optional
 *  compact actions on the right, on the status token ramp. */
function SearchBanner({ tone, title, detail, actions }: {
  tone: 'warning' | 'info';
  title: ReactNode;
  detail: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <StatusMessage tone={tone} className="mx-3 mb-2 flex items-start justify-between gap-2.5 px-2.25 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="font-semibold">{title}</div>
        <div className="leading-snug opacity-90">{detail}</div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </StatusMessage>
  );
}

/** Readiness explanation for the ACTIVE folder — preparation, indexing, and
 *  failure counts come from the folder-scoped status poll. Other folders'
 *  readiness is not reported here (no library-wide status surface yet).
 *  `onNavigateAway` closes the popup before opening Settings — the Settings
 *  dialog stacks BELOW the picker veil. */
function SearchStatusBanner({ semanticMode, onNavigateAway }: {
  semanticMode: boolean;
  onNavigateAway: () => void;
}) {
  const { state, actions } = useApp();
  const semanticDisabled = state.embedderHasKey === false;
  const conversionPendingCount = state.pendingConversions.length;
  const semanticPendingPaths = new Set<string>();
  for (const path of state.pendingSemanticNames) semanticPendingPaths.add(path);
  for (const path of state.pendingConversions) semanticPendingPaths.add(path);
  const semanticPendingCount = semanticPendingPaths.size;
  const pendingCount = semanticMode ? semanticPendingCount : conversionPendingCount;
  const failedCount = state.preparationFailures.filter((problem) => problem.status !== 'cancelled').length;
  const cancelledCount = state.preparationFailures.length - failedCount;
  const failureCount = failedCount + cancelledCount;
  const blockedCount = state.blockedConversions.length;
  const total = state.files.length;
  const unavailablePaths = new Set([
    ...state.pendingConversions,
    ...state.preparationFailures.map((failure) => failure.path),
    ...state.blockedConversions,
    ...(semanticMode ? [...state.pendingSemanticNames] : []),
  ]);
  const readyCount = Math.max(0, total - unavailablePaths.size);

  if (state.semanticIndexing && ['awaiting-decision', 'paused', 'partial-paused'].includes(state.semanticIndexing.state)) return null;

  if (semanticMode && state.indexWarning) {
    return (
      <SearchBanner
        tone="warning"
        title="Search needs attention"
        detail={<>Search may be incomplete: {state.indexWarning.message}</>}
        actions={
          <>
            <Button variant="outline" size="xs" onClick={() => { void actions.runSync(); }}>Retry</Button>
            <Button variant="outline" size="xs" onClick={() => { void actions.dismissIndexWarning(); }}>Dismiss</Button>
          </>
        }
      />
    );
  }

  if (failureCount > 0) {
    return (
      <SearchBanner
        tone="warning"
        title={failedCount > 0 ? 'Some files could not be prepared for search.' : 'Some file preparation was cancelled.'}
        detail={
          <>
            {[
              failedCount > 0 ? `${failedCount} failed` : '',
              cancelledCount > 0 ? `${cancelledCount} cancelled` : '',
            ].filter(Boolean).join(' · ')}. Open a file to retry it.
          </>
        }
      />
    );
  }

  if (blockedCount > 0) {
    return (
      <SearchBanner
        tone="warning"
        title="Transcription setup required"
        detail={
          <>
            {readyCount} file{readyCount === 1 ? ' is' : 's are'} ready to search. {blockedCount} media file{blockedCount === 1 ? '' : 's'} need transcription setup.
          </>
        }
        actions={
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              onNavigateAway();
              openSettings('transcription');
            }}
          >
            Open Settings
          </Button>
        }
      />
    );
  }

  if (semanticMode && semanticDisabled) return null;

  if (pendingCount > 0) {
    const readyLabel = `${readyCount} file${readyCount === 1 ? '' : 's'} ${readyCount === 1 ? 'is' : 'are'} ready to search.`;
    const pendingLabel = semanticMode
      ? `${pendingCount} ${pendingCount === 1 ? 'is' : 'are'} still being prepared.`
      : `${pendingCount} ${pendingCount === 1 ? 'is' : 'are'} still being converted.`;
    return (
      <SearchBanner
        tone="info"
        title={semanticMode ? 'Making files searchable' : 'Preparing text for exact search'}
        detail={<>{readyLabel} {pendingLabel}</>}
      />
    );
  }

  return null;
}

function highlightRanges(text: string, ranges: Array<[number, number]>) {
  if (ranges.length === 0) return <span>{text}</span>;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push(<span key={`g${cursor}`}>{text.slice(cursor, start)}</span>);
    parts.push(<mark key={`m${start}`}>{text.slice(start, end)}</mark>);
    cursor = end;
  }
  if (cursor < text.length) parts.push(<span key={`g${cursor}`}>{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

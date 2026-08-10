import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FileMeta, KeywordHitFile, KeywordMatch, SearchHit } from '../api';
import { useApp } from '../store/AppContext';
import { openSettings } from './SettingsModal';
import { guiSemanticVisibleCount } from '../store/appContextHelpers';
import { relevanceRatios } from '../lib/searchRelevance';
import { searchSnippetText } from '../lib/searchSnippet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { StatusMessage } from './ui/status';
import type { SearchTypeCategory } from '../../../shared/search-types.ts';
import { SemanticIndexingNotice } from './SemanticIndexingNotice';

/**
 * The "search" sidebar view — owns the search input, the mode toggle
 * (≈ ↔ =) with conditional `Aa` / `Word` sub-filters when in keyword
 * mode, the subfolder-scope and file-type filter row, and the result
 * list.
 *
 * Empty query → empty body (no "Recent searches" prompt yet — that's
 * deferred until we add a real history feature).
 *
 * This component is intentionally siblings with `FilesPanel`, switched
 * by `state.activeSidebarView` from the `Sidebar` wrapper. Splitting
 * search out of the files panel means the user no longer has to clear
 * the query to get the tree back — they just click the Files icon in
 * the activity bar.
 */

/** Latch buttons (Aa / Word, file-type chips) — quiet until pressed,
 *  then the accent state ladder (thin accent stroke + tinted fill)
 *  driven off aria-pressed, matching the FindBar toggles. */
const MODE_TOGGLE_CLASS =
  'h-5 min-w-5.5 rounded-sm px-1 text-xs font-normal text-muted-foreground aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent';

const TYPE_CHIP_CLASS =
  'h-5 rounded-xl px-1.75 text-xs font-normal text-muted-foreground aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent';

/** Result-list paddings shared by the semantic and keyword lists. */
const HIT_LIST_CLASS = 'px-1.5 py-1';
const HIT_SUMMARY_CLASS = 'px-2.5 pt-0.5 pb-1.5 text-xs text-muted-foreground';

export function SearchPanel() {
  const { state } = useApp();
  const query = state.filterQuery.trim();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" id="sidebar-panel-search" role="tabpanel">
      <SearchBox />
      <SearchFilters />
      <SemanticIndexingNotice />
      <SearchStatusBanner />
      {/* Results scroll vertically; the input above stays pinned. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {state.searchMode === 'semantic' && state.embedderHasKey === false ? (
          <SearchResults query={query} />
        ) : query ? (
          <SearchResults query={query} />
        ) : (
          // Per design: nothing shown until the user starts typing.
          // The user has plenty of feedback from the input itself.
          null
        )}
      </div>
    </div>
  );
}

const SEARCH_TYPE_CHIPS: Array<{ type: SearchTypeCategory; label: string; title: string }> = [
  { type: 'notes', label: 'Notes', title: 'Markdown and HTML' },
  { type: 'pdf', label: 'PDF', title: 'PDF documents' },
  { type: 'image', label: 'Images', title: 'OCR-searchable images' },
  { type: 'docx', label: 'DOCX', title: 'Word documents' },
  { type: 'audio', label: 'Media', title: 'Transcribed audio and video' },
];

/** Subfolder scope + file-type chips. Both narrow the NEXT search in
 *  either mode and compose; no selection = whole folder, every type.
 *  The chips are independent multi-toggles (any subset may be active),
 *  so they are latch chips, not a segmented control. */
function SearchFilters() {
  const { state, actions, dispatch } = useApp();
  const scopes = subfolderScopes(state.files);
  const staleScope = state.searchScope != null && !scopes.includes(state.searchScope);

  function rerun(next: { scope?: string | null; types?: SearchTypeCategory[] }) {
    if (state.filterQuery.trim()) void actions.runSearch(state.filterQuery, undefined, next);
  }

  function setScope(scope: string | null) {
    dispatch({ type: 'SEARCH_SCOPE', scope });
    rerun({ scope });
  }

  function toggleType(type: SearchTypeCategory) {
    const types = state.searchTypes.includes(type)
      ? state.searchTypes.filter((t) => t !== type)
      : [...state.searchTypes, type];
    dispatch({ type: 'SEARCH_TYPES', types });
    rerun({ types });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
      {(scopes.length > 0 || staleScope) && (
        <select
          className="h-5 max-w-full rounded-sm border border-input bg-background px-1 text-xs text-muted-foreground outline-none focus:border-accent"
          value={state.searchScope ?? ''}
          onChange={(e) => setScope(e.target.value || null)}
          aria-label="Search scope"
          title="Limit search to a subfolder"
        >
          <option value="">All folders</option>
          {staleScope && <option value={state.searchScope!}>{state.searchScope}</option>}
          {scopes.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
        </select>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-0.5" role="group" aria-label="File types">
        {SEARCH_TYPE_CHIPS.map(({ type, label, title }) => (
          <Button
            key={type}
            variant="ghost"
            size="xs"
            className={TYPE_CHIP_CLASS}
            aria-pressed={state.searchTypes.includes(type)}
            title={title}
            onClick={() => toggleType(type)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Every directory that contains a visible file, folder-relative,
 *  sorted. Derived from the file list so the options always reflect
 *  the live tree. */
function subfolderScopes(files: FileMeta[]): string[] {
  const dirs = new Set<string>();
  for (const file of files) {
    const parts = file.name.split('/');
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }
  return [...dirs].sort((a, b) => a.localeCompare(b));
}

/** One readiness/problem banner: title + detail copy on the left,
 *  optional compact actions on the right, on the status token ramp. */
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

function SearchStatusBanner() {
  const { state, actions } = useApp();
  const isSemantic = state.searchMode === 'semantic';
  const semanticDisabled = state.embedderHasKey === false;
  const conversionPendingCount = state.pendingConversions.length;
  const semanticPendingPaths = new Set<string>();
  for (const path of state.pendingSemanticNames) semanticPendingPaths.add(path);
  for (const path of state.pendingConversions) semanticPendingPaths.add(path);
  const semanticPendingCount = semanticPendingPaths.size;
  const pendingCount = isSemantic ? semanticPendingCount : conversionPendingCount;
  const failedCount = state.preparationFailures.filter((problem) => problem.status !== 'cancelled').length;
  const cancelledCount = state.preparationFailures.length - failedCount;
  const failureCount = failedCount + cancelledCount;
  const blockedCount = state.blockedConversions.length;
  const total = state.files.length;
  const unavailablePaths = new Set([
    ...state.pendingConversions,
    ...state.preparationFailures.map((failure) => failure.path),
    ...state.blockedConversions,
    ...(isSemantic ? [...state.pendingSemanticNames] : []),
  ]);
  const readyCount = Math.max(0, total - unavailablePaths.size);

  if (state.semanticIndexing && ['awaiting-decision', 'paused', 'partial-paused'].includes(state.semanticIndexing.state)) return null;

  if (isSemantic && state.indexWarning) {
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
        actions={<Button variant="outline" size="xs" onClick={() => openSettings('transcription')}>Open Settings</Button>}
      />
    );
  }

  if (isSemantic && semanticDisabled) return null;

  if (pendingCount > 0) {
    const readyLabel = `${readyCount} file${readyCount === 1 ? '' : 's'} ${readyCount === 1 ? 'is' : 'are'} ready to search.`;
    const pendingLabel = isSemantic
      ? `${pendingCount} ${pendingCount === 1 ? 'is' : 'are'} still being prepared.`
      : `${pendingCount} ${pendingCount === 1 ? 'is' : 'are'} still being converted.`;
    return (
      <SearchBanner
        tone="info"
        title={isSemantic ? 'Making files searchable' : 'Preparing text for keyword search'}
        detail={<>{readyLabel} {pendingLabel}</>}
      />
    );
  }

  return null;
}

/** Input + ≈/= mode flip + (keyword-only) Aa / Word sub-toggles. The
 *  mode flip swaps the icon based on current mode so the button
 *  doubles as a state indicator. */
function SearchBox() {
  const { state, actions, dispatch } = useApp();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);

  // Hand the input handle to the store on mount so `actions.focusSearch`
  // can reach it without a global DOM query.
  useEffect(() => {
    actions.registerSearchInput(inputRef.current);
    return () => actions.registerSearchInput(null);
  }, [actions]);

  // Keep results fresh against the current content. This fires on mount
  // (returning to Search after a view switch — the Sidebar mounts/
  // unmounts SearchPanel) AND whenever the content changes underneath
  // while Search stays open: a new/removed note (`files`) or a finished
  // screenshot/PDF conversion (`pendingConversions` — its OCR text only
  // becomes searchable once conversion completes, which also reloads
  // `files`). Without this the user must edit the query to see new
  // matches, since results live in the store and aren't otherwise
  // refetched.
  useEffect(() => {
    if (state.filterQuery.trim()) void actions.runSearch(state.filterQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.files, state.pendingConversions]);

  function onChange(value: string) {
    dispatch({ type: 'FILTER', q: value });
    if (debounce.current) clearTimeout(debounce.current);
    if (!value.trim()) {
      void actions.runSearch('');
      return;
    }
    dispatch({ type: 'SEARCH_START' });
    debounce.current = setTimeout(() => { void actions.runSearch(value); }, 250);
  }

  function flipMode() {
    const next = state.searchMode === 'semantic' ? 'keyword' : 'semantic';
    dispatch({ type: 'SEARCH_MODE', mode: next });
    if (state.filterQuery.trim()) {
      void actions.runSearch(state.filterQuery, next);
    }
  }

  function toggleCaseStrict() {
    const next = !state.caseStrict;
    dispatch({ type: 'SEARCH_CASE_STRICT', strict: next });
    if (state.filterQuery.trim()) {
      void actions.runSearch(state.filterQuery, 'keyword', {
        caseStrict: next,
        wholeWord: state.wholeWord,
      });
    }
  }

  function toggleWholeWord() {
    const next = !state.wholeWord;
    dispatch({ type: 'SEARCH_WHOLE_WORD', on: next });
    if (state.filterQuery.trim()) {
      void actions.runSearch(state.filterQuery, 'keyword', {
        caseStrict: state.caseStrict,
        wholeWord: next,
      });
    }
  }

  const isKeyword = state.searchMode === 'keyword';
  const semanticDisabled = state.embedderHasKey === false;

  return (
    // The activity bar already carries the magnifier icon for the view
    // itself, so the input has no leading glyph. Mode toggles (≈/= flip,
    // plus Aa / Word when keyword) overlay the right end of the input
    // row, which is why the input reserves right padding.
    <div className="relative px-3 pt-2.5 pb-2">
      {/* `type="text"` (not `search`) on purpose — we don't want the
       *  native cancel-X glyph crowding the toggle row on the right,
       *  and we don't want the native Esc-clears-input behaviour
       *  either; clearing happens by deleting characters or by
       *  flipping back to Files via the activity bar. */}
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search…"
        autoComplete="off"
        spellCheck={false}
        className="pr-28"
        value={state.filterQuery}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-0.5" role="group" aria-label="Search mode">
        {isKeyword && (
          <>
            <Button
              variant="ghost"
              size="xs"
              className={MODE_TOGGLE_CLASS}
              onClick={toggleCaseStrict}
              aria-label="Match case"
              aria-pressed={state.caseStrict}
              title="Match Case"
            >
              Aa
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className={MODE_TOGGLE_CLASS + ' min-w-8.5'}
              onClick={toggleWholeWord}
              aria-label="Match whole word"
              aria-pressed={state.wholeWord}
              title="Whole word"
            >
              Word
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="xs"
          className="h-5 min-w-5.5 rounded-sm px-1 text-base font-semibold text-muted-foreground"
          onClick={flipMode}
          aria-label={isKeyword ? 'Switch to semantic search' : 'Switch to keyword search'}
          title={
            isKeyword
              ? semanticDisabled ? 'Keyword search · click for semantic setup' : 'Keyword search · click for semantic'
              : 'Semantic search · click for keyword'
          }
        >
          {isKeyword ? '=' : '≈'}
        </Button>
      </div>
    </div>
  );
}

function SearchResults({ query }: { query: string }) {
  const { state } = useApp();
  if (state.searchMode === 'semantic' && state.embedderHasKey === false) {
    return (
      <div className="empty-list">
        <div>Semantic search needs an embedding API key.</div>
        <div>Keyword search works without embeddings.</div>
      </div>
    );
  }

  // A real failure (server / daemon error) — distinct from "no matches".
  if (state.searchError) {
    if (state.searchError.startsWith('Semantic search is disabled')) {
      return (
        <div className="empty-list">
          <div>Semantic search needs an embedding API key.</div>
          <div>Keyword search works without embeddings.</div>
        </div>
      );
    }
    return <div className="empty-list">Search failed: {state.searchError}</div>;
  }
  if (state.searchMode === 'keyword') {
    return <KeywordSearchResults query={query} />;
  }
  if (state.searching && state.searchHits === null) {
    return <div className="empty-list">Searching…</div>;
  }
  if (!state.searchHits || state.searchHits.length === 0) {
    return <div className="empty-list">No matches</div>;
  }
  return <SemanticSearchResults hits={state.searchHits} />;
}

const SEMANTIC_SHOW_MORE_STEP = 8;

/** Ranked semantic hits with a relative relevance bar per hit.
 *
 *  Every fetched candidate is kept in state. The strongest slice (the
 *  relevance knee, via `guiSemanticVisibleCount`) shows first, and the
 *  remaining already-fetched candidates are revealed in steps with no
 *  further request. Disclosure resets whenever a new search arrives (a
 *  fresh `hits` array from a query, scope, type-filter, or mode change),
 *  and relevance is normalized across the whole fetched set. */
function SemanticSearchResults({ hits }: { hits: SearchHit[] }) {
  const [visible, setVisible] = useState(() => guiSemanticVisibleCount(hits));
  useEffect(() => { setVisible(guiSemanticVisibleCount(hits)); }, [hits]);

  const ratios = relevanceRatios(hits.map((hit) => hit.score));
  const shown = Math.min(visible, hits.length);
  const remaining = hits.length - shown;

  return (
    <div className={HIT_LIST_CLASS}>
      <div className={HIT_SUMMARY_CLASS}>
        {remaining > 0
          ? `${shown} of ${hits.length} results`
          : `${hits.length} result${hits.length === 1 ? '' : 's'}`}
      </div>
      {hits.slice(0, shown).map((hit, i) => (
        <SearchHitRow key={`${hit.fileName}#${hit.chunkIndex}#${i}`} hit={hit} relevance={ratios[i]} />
      ))}
      {remaining > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mt-0.5 mb-1 w-full font-normal text-accent"
          onClick={() => setVisible((current) => current + SEMANTIC_SHOW_MORE_STEP)}
        >
          Show {Math.min(remaining, SEMANTIC_SHOW_MORE_STEP)} more
        </Button>
      )}
    </div>
  );
}

function KeywordSearchResults({ query }: { query: string }) {
  const { state } = useApp();
  if (state.searching && state.keywordResult === null) {
    return <div className="empty-list">Searching…</div>;
  }
  const result = state.keywordResult;
  if (!result || result.files.length === 0) {
    return <div className="empty-list">No matches</div>;
  }
  return (
    <div className={HIT_LIST_CLASS}>
      <div className={HIT_SUMMARY_CLASS}>
        {result.totalMatches} match{result.totalMatches === 1 ? '' : 'es'} in {result.files.length} file{result.files.length === 1 ? '' : 's'}
        {result.truncated && ' (truncated)'}
      </div>
      {result.files.map((file) => (
        <KeywordFileGroup key={file.path} file={file} query={query} />
      ))}
    </div>
  );
}

function KeywordFileGroup({ file, query }: { file: KeywordHitFile; query: string }) {
  const { actions } = useApp();
  const basename = file.path.split('/').pop() ?? file.path;
  const hiddenCount = file.totalMatches - file.matches.length;
  return (
    <div className="mb-1.5">
      <div
        className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 hover:bg-muted"
        title={file.path}
        onClick={() => {
          void actions.selectFileWithHighlight(file.path, {
            startLine: file.matches[0]?.line,
            chunkText: query,
            audioSeekText: file.matches[0]?.text,
            audioSeekMs: file.matches[0]?.audioTimestampMs,
            openFindBar: true,
            pdfPage: file.matches[0]?.pdfPage,
          });
        }}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{basename}</span>
        <span className="min-w-4 shrink-0 rounded-lg bg-muted px-1.25 text-center text-2xs leading-4 text-muted-foreground">{file.totalMatches}</span>
      </div>
      {file.matches.map((m, i) => (
        <KeywordMatchRow key={`${file.path}#${m.line}#${i}`} file={file} match={m} query={query} />
      ))}
      {hiddenCount > 0 && (
        <div className="cursor-default py-0.5 pr-2.5 pl-4 text-xs text-muted-foreground">+ {hiddenCount} more in this file</div>
      )}
    </div>
  );
}

function KeywordMatchRow({ file, match, query }: { file: KeywordHitFile; match: KeywordMatch; query: string }) {
  const { actions } = useApp();
  return (
    <div
      className="flex cursor-pointer items-baseline gap-2 rounded-sm py-0.5 pr-2.5 pl-4 text-sm leading-normal hover:bg-muted"
      onClick={() => {
        void actions.selectFileWithHighlight(file.path, {
          startLine: match.line,
          chunkText: query,
          audioSeekText: match.text,
          audioSeekMs: match.audioTimestampMs,
          openFindBar: true,
          pdfPage: match.pdfPage,
        });
      }}
      title={`Line ${match.line}`}
    >
      <span className="min-w-6.5 shrink-0 text-right text-muted-foreground tabular-nums select-none">{match.line}</span>
      <span className="min-w-0 flex-1 truncate text-foreground [&_mark]:rounded-xs [&_mark]:bg-accent-amber/30 [&_mark]:px-px [&_mark]:text-inherit">
        {highlightRanges(match.text, match.ranges)}
      </span>
    </div>
  );
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

function SearchHitRow({ hit, relevance }: { hit: SearchHit; relevance?: number }) {
  const { actions } = useApp();
  const fileBasename = hit.fileName.split('/').pop() ?? hit.fileName;
  // No term highlighting on semantic snippets: a semantic hit isn't a
  // literal substring match, so marking the query words is misleading —
  // only keyword search (real ranges) highlights. Plain, truncated text,
  // with any leading YAML frontmatter stripped for DISPLAY only —
  // `hit.content` stays raw because it anchors click-through navigation.
  const snippetSource = searchSnippetText(hit.content);
  const snippet = snippetSource.length > 240 ? snippetSource.slice(0, 240) + '…' : snippetSource;
  const relevanceLabel = relevance != null
    ? `Relative match strength: ${Math.round(relevance * 100)}%`
    : undefined;
  return (
    <div
      className="mb-1 cursor-pointer rounded-md border border-transparent px-2.5 py-2 hover:border-border hover:bg-muted"
      onClick={() => {
        void actions.selectFileWithHighlight(hit.fileName, {
          startLine: hit.startLine,
          endLine: hit.endLine,
          chunkText: hit.content,
          pdfPage: hit.pdfPage,
        });
      }}
      title={hit.fileName}
    >
      {hit.heading && <div className="mb-1 truncate text-xs font-medium tracking-wide text-muted-foreground">{hit.heading}</div>}
      <div className="line-clamp-3 text-sm text-foreground">{snippet}</div>
      <div className="mt-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{fileBasename}</span>
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

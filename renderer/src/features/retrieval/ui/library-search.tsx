import { Search, Sparkles, TextSearch } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { CommandItem, CommandList } from '@/components/ui/command-menu';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { InputField, InputGroup } from '@/components/ui/input-group';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import type {
  ExactSearchApi,
  IndexDecisionApi,
  SemanticSearchApi,
} from '@/features/retrieval/application/ports';
import {
  exactSearchNavigationIntent,
  exactSearchOccurrences,
  exactSearchSegments,
  type ExactSearchMatch,
  type ExactSearchNavigationIntent,
  type ExactSearchOccurrence,
} from '@/features/retrieval/domain/exact-search';
import {
  preparationReadinessLine,
  semanticReadiness,
  type PreparationCounts,
} from '@/features/retrieval/domain/semantic-readiness';
import {
  SEMANTIC_SEARCH_CANDIDATES,
  groupSemanticHits,
  semanticNavigationIntent,
  type SemanticHit,
} from '@/features/retrieval/domain/semantic-search';
import { useExactSearch } from '@/features/retrieval/hooks/use-exact-search';
import { useIndexDecisions } from '@/features/retrieval/hooks/use-index-decisions';
import { useSemanticSearch } from '@/features/retrieval/hooks/use-semantic-search';
import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';

import { PreparationReadinessNotice, SemanticReadinessNotice } from './readiness-notices';

const resultPageSize = 6;

export type SearchMode = 'exact' | 'similar';

export interface LibrarySearchProps {
  active: boolean;
  activeFolderPath: string;
  decisionApi: IndexDecisionApi;
  exactApi: ExactSearchApi;
  focusRevision: number;
  onNavigate(intent: ExactSearchNavigationIntent): Promise<boolean>;
  onOpenSettings(section: 'ai-index' | 'transcription'): void;
  preparation: PreparationCounts;
  semanticApi: SemanticSearchApi;
  status: FolderIndexStatus | null;
}

function basename(path: string): string {
  return path.split(/[\\/]/u).at(-1) ?? path;
}

function parentPath(path: string): string {
  const parts = path.split(/[\\/]/u);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

function timestamp(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function matchLocation(match: ExactSearchMatch): string {
  if (match.pdfPage) return `Page ${match.pdfPage}`;
  if (match.audioTimestampMs !== undefined) return timestamp(match.audioTimestampMs);
  return `Line ${match.line}`;
}

function hitLocation(hit: SemanticHit): string {
  if (hit.heading) return hit.heading;
  if (hit.pdfPage) return `Page ${hit.pdfPage}`;
  if (hit.startLine) return `Line ${hit.startLine}`;
  return '';
}

function Evidence({ occurrence }: { occurrence: ExactSearchOccurrence }) {
  return (
    <span className="line-clamp-2 text-caption leading-relaxed break-words text-muted-foreground">
      {exactSearchSegments(occurrence.match.text, [occurrence.range]).map((segment) =>
        segment.highlighted ? (
          <mark className="bg-accent text-foreground" key={segment.offset}>
            {segment.text}
          </mark>
        ) : (
          <span key={segment.offset}>{segment.text}</span>
        ),
      )}
    </span>
  );
}

function StatusLine({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) {
  return (
    <p
      className={
        tone === 'error'
          ? 'px-4 py-2 text-caption text-destructive'
          : 'px-4 py-2 text-caption text-muted-foreground'
      }
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}

export function LibrarySearch({
  active,
  activeFolderPath,
  decisionApi,
  exactApi,
  focusRevision,
  onNavigate,
  onOpenSettings,
  preparation,
  semanticApi,
  status,
}: LibrarySearchProps) {
  const [mode, setMode] = useState<SearchMode>('exact');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [navigationFailure, setNavigationFailure] = useState(false);
  const inputGroup = useRef<HTMLDivElement | null>(null);
  const resultsId = useId();
  const trimmedQuery = query.trim();
  const readiness = useMemo(() => semanticReadiness(status?.semantic), [status?.semantic]);
  const decisions = useIndexDecisions(decisionApi, activeFolderPath);

  const exactRequest = useMemo(() => {
    if (!trimmedQuery || mode !== 'exact') return null;
    return {
      caseSensitive: /[A-Z]/u.test(trimmedQuery),
      folderPath: activeFolderPath,
      query: trimmedQuery,
      wholeWord: false,
    };
  }, [activeFolderPath, mode, trimmedQuery]);
  const exact = useExactSearch(exactApi, exactRequest);
  const files = useMemo(
    () => (exact.data?.files ?? []).filter((file) => file.source.folderPath === activeFolderPath),
    [activeFolderPath, exact.data?.files],
  );
  const groups = useMemo(
    () =>
      files
        .map((file) => ({ file, occurrences: exactSearchOccurrences(file) }))
        .filter((group) => group.occurrences.length > 0),
    [files],
  );
  const occurrences = useMemo(() => groups.flatMap((group) => group.occurrences), [groups]);

  const semanticRequest = useMemo(() => {
    if (!trimmedQuery || mode !== 'similar') return null;
    return { folderPath: activeFolderPath, query: trimmedQuery, topK: SEMANTIC_SEARCH_CANDIDATES };
  }, [activeFolderPath, mode, trimmedQuery]);
  const similar = useSemanticSearch(semanticApi, semanticRequest, readiness.canSearch);
  const hits = similar.data?.hits ?? [];
  const hitGroups = useMemo(() => groupSemanticHits(hits, 'folder'), [hits]);

  const request = mode === 'exact' ? exactRequest : semanticRequest;
  const search = mode === 'exact' ? exact : similar;
  const itemCount = mode === 'exact' ? occurrences.length : hits.length;
  const searching = request !== null && (search.isSettling || search.isFetching);
  const readyCount = status
    ? Math.max(0, status.total - preparation.pending - preparation.blocked)
    : 0;
  const preparationLine = preparationReadinessLine(preparation, readyCount);
  const showSemanticNotice =
    readiness.prominent || readiness.state === 'failed' || mode === 'similar';

  useEffect(() => setActiveIndex(0), [activeFolderPath, exact.data, similar.data, query, mode]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => inputGroup.current?.querySelector('input')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [active, focusRevision]);

  const navigate = async (intent: ExactSearchNavigationIntent) => {
    setNavigationFailure(false);
    try {
      if (await onNavigate(intent)) return;
    } catch {
      // The local recovery below intentionally excludes filesystem details.
    }
    setNavigationFailure(true);
  };

  const openOccurrence = (occurrence: ExactSearchOccurrence) => {
    if (!exactRequest) return;
    void navigate(exactSearchNavigationIntent(occurrence, exactRequest));
  };

  const openHit = (hit: SemanticHit) => void navigate(semanticNavigationIntent(hit));

  const openIndex = (index: number) => {
    if (mode === 'exact') {
      const occurrence = occurrences[index];
      if (occurrence) openOccurrence(occurrence);
    } else {
      const hit = hits[index];
      if (hit) openHit(hit);
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && search.isSettling) {
      event.preventDefault();
      search.submit();
      return;
    }
    if (itemCount === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, itemCount - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(itemCount - 1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + resultPageSize, itemCount - 1));
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - resultPageSize, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openIndex(activeIndex);
    }
  };

  const inputLabel = 'Search current workspace';
  const similarTitle = readiness.canSearch
    ? 'Match by meaning'
    : 'Match by meaning — needs AI Index';

  return (
    <section
      aria-label={mode === 'exact' ? 'Exact workspace search' : 'Similar search'}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="shrink-0 px-2 pb-2">
        <InputGroup className="w-full gap-0" ref={inputGroup} size="compact">
          <InputField
            aria-activedescendant={
              itemCount > activeIndex ? `${resultsId}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={itemCount > 0 ? resultsId : undefined}
            aria-expanded={itemCount > 0}
            aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
            autoComplete="off"
            icon={Search}
            index={0}
            label={inputLabel}
            labelHidden
            onChange={setQuery}
            onKeyDown={onInputKeyDown}
            placeholder={mode === 'exact' ? 'Search files' : 'Describe what you are looking for'}
            role="combobox"
            spellCheck={false}
            value={query}
          />
        </InputGroup>
        <div className="flex items-center pt-1.5">
          <TabsSubtle
            aria-label="Search mode"
            idPrefix={`${resultsId}-mode`}
            onSelect={(index) => setMode(index === 0 ? 'exact' : 'similar')}
            selectedIndex={mode === 'exact' ? 0 : 1}
            size="compact"
          >
            <TabsSubtleItem icon={TextSearch} index={0} label="Exact" title="Match exact text" />
            <TabsSubtleItem icon={Sparkles} index={1} label="Similar" title={similarTitle} />
          </TabsSubtle>
        </div>
      </div>

      {showSemanticNotice && (
        <SemanticReadinessNotice
          error={decisions.error}
          onDecision={decisions.run}
          onOpenSettings={() => onOpenSettings('ai-index')}
          pendingAction={decisions.pendingAction}
          readiness={readiness}
        />
      )}

      {preparationLine && (
        <PreparationReadinessNotice
          line={preparationLine}
          onOpenSettings={() => onOpenSettings('transcription')}
        />
      )}

      {!request && mode === 'exact' && <StatusLine>Type to search exact text.</StatusLine>}
      {!request && mode === 'similar' && readiness.canSearch && (
        <StatusLine>Type to search by meaning.</StatusLine>
      )}

      {request && searching && <StatusLine>Searching…</StatusLine>}

      {request && !searching && search.isError && (
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <p className="text-caption text-destructive" role="alert">
            {mode === 'exact'
              ? 'Search is unavailable.'
              : (search.error?.message ?? 'Search is unavailable.')}
          </p>
          <Button onClick={() => void search.refetch()} size="compact" variant="tertiary">
            Retry
          </Button>
        </div>
      )}

      {request && !searching && search.isSuccess && itemCount === 0 && (
        <StatusLine>{mode === 'exact' ? 'No exact matches.' : 'No similar results.'}</StatusLine>
      )}

      {mode === 'exact' && request && !searching && occurrences.length > 0 && (
        <CommandList
          activeIndex={activeIndex}
          aria-label="Exact search results"
          className="max-h-none min-h-0 flex-1"
          id={resultsId}
          itemCount={occurrences.length}
          onActiveIndexChange={setActiveIndex}
          role="listbox"
        >
          {groups.map(({ file, occurrences: fileOccurrences }, groupIndex) => {
            const directory = parentPath(file.source.path);
            const groupId = `${resultsId}-file-${groupIndex}`;
            return (
              <div aria-labelledby={groupId} key={file.id} role="group">
                <div
                  className="flex min-w-0 items-center gap-2 px-3 pt-2 pb-1 text-caption"
                  id={groupId}
                >
                  <FileTypeIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                    path={file.source.path}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {basename(file.source.path)}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {file.totalMatches}
                  </span>
                </div>
                {directory && (
                  <p className="truncate px-9 pb-1 text-[10px] text-muted-foreground">
                    {directory}
                  </p>
                )}
                {fileOccurrences.map((occurrence) => {
                  const index = occurrences.indexOf(occurrence);
                  const selected = index === activeIndex;
                  const location = matchLocation(occurrence.match);
                  const accessibleEvidence = occurrence.match.text.trim() || 'Matching source';
                  return (
                    <CommandItem
                      active={selected}
                      aria-label={`${basename(file.source.path)}${directory ? `, ${directory}` : ''}, ${location}, ${accessibleEvidence}`}
                      className="h-auto min-h-11 items-start py-1.5 pl-9"
                      id={`${resultsId}-${index}`}
                      index={index}
                      key={occurrence.id}
                      onClick={() => openOccurrence(occurrence)}
                    >
                      <span className="mt-0.5 w-9 shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {location}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Evidence occurrence={occurrence} />
                      </span>
                    </CommandItem>
                  );
                })}
              </div>
            );
          })}
        </CommandList>
      )}

      {mode === 'similar' && request && !searching && hits.length > 0 && (
        <CommandList
          activeIndex={activeIndex}
          aria-label="Similar results"
          className="max-h-none min-h-0 flex-1"
          id={resultsId}
          itemCount={hits.length}
          onActiveIndexChange={setActiveIndex}
          role="listbox"
        >
          {hitGroups.map((group) => {
            return (
              <div key={group.folderPath}>
                {group.hits.map((hit) => {
                  const index = hits.indexOf(hit);
                  const selected = index === activeIndex;
                  const directory = parentPath(hit.source.path);
                  const location = hitLocation(hit);
                  return (
                    <CommandItem
                      active={selected}
                      aria-label={`${basename(hit.source.path)}${directory ? `, ${directory}` : ''}${location ? `, ${location}` : ''}, ${hit.snippet || 'Similar source'}`}
                      className="h-auto min-h-11 flex-col items-stretch gap-0.5 py-1.5"
                      id={`${resultsId}-${index}`}
                      index={index}
                      key={hit.id}
                      onClick={() => openHit(hit)}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-caption">
                        <FileTypeIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                          path={hit.source.path}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {basename(hit.source.path)}
                        </span>
                        {location && (
                          <span className="max-w-[45%] shrink-0 truncate text-[10px] text-muted-foreground">
                            {location}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 pl-6 text-left text-caption leading-relaxed break-words text-muted-foreground">
                        {hit.snippet}
                      </span>
                    </CommandItem>
                  );
                })}
              </div>
            );
          })}
        </CommandList>
      )}

      {mode === 'exact' && exact.data?.truncated && !searching && (
        <p
          className="shrink-0 border-t border-border px-4 py-2 text-[10px] text-muted-foreground"
          role="status"
        >
          Showing the first results from {exact.data.totalMatches.toLocaleString()} matches.
        </p>
      )}

      {mode === 'similar' && similar.data?.truncated && !searching && (
        <p
          className="shrink-0 border-t border-border px-4 py-2 text-[10px] text-muted-foreground"
          role="status"
        >
          Showing the strongest {hits.length} results.
        </p>
      )}

      {navigationFailure && (
        <p
          className="shrink-0 border-t border-border px-4 py-2 text-caption text-destructive"
          role="alert"
        >
          Could not open this source. Your current document remains available.
        </p>
      )}
    </section>
  );
}

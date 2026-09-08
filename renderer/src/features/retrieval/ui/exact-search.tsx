import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { CommandItem, CommandList } from '@/components/ui/command-menu';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { InputField, InputGroup } from '@/components/ui/input-group';
import type { ExactSearchApi } from '@/features/retrieval/application/ports';
import {
  exactSearchNavigationIntent,
  exactSearchOccurrences,
  exactSearchSegments,
  type ExactSearchMatch,
  type ExactSearchNavigationIntent,
  type ExactSearchOccurrence,
} from '@/features/retrieval/domain/exact-search';
import { useExactSearch } from '@/features/retrieval/hooks/use-exact-search';

const resultPageSize = 6;

export interface ExactSearchProps {
  active: boolean;
  activeFolderPath: string;
  api: ExactSearchApi;
  focusRevision: number;
  onNavigate(intent: ExactSearchNavigationIntent): Promise<boolean>;
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

export function ExactSearch({
  active,
  activeFolderPath,
  api,
  focusRevision,
  onNavigate,
}: ExactSearchProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [navigationFailure, setNavigationFailure] = useState(false);
  const inputGroup = useRef<HTMLDivElement | null>(null);
  const resultsId = useId();
  const request = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return null;
    return {
      caseSensitive: /[A-Z]/u.test(trimmedQuery),
      folderPath: activeFolderPath,
      query: trimmedQuery,
      wholeWord: false,
    };
  }, [activeFolderPath, query]);
  const search = useExactSearch(api, request);
  const files = useMemo(
    () => (search.data?.files ?? []).filter((file) => file.source.folderPath === activeFolderPath),
    [activeFolderPath, search.data?.files],
  );
  const groups = useMemo(
    () =>
      files
        .map((file) => ({ file, occurrences: exactSearchOccurrences(file) }))
        .filter((group) => group.occurrences.length > 0),
    [files],
  );
  const occurrences = useMemo(() => groups.flatMap((group) => group.occurrences), [groups]);
  const searching = request !== null && (search.isSettling || search.isFetching);

  useEffect(() => setActiveIndex(0), [activeFolderPath, search.data, query]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => inputGroup.current?.querySelector('input')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [active, focusRevision]);

  const open = async (occurrence: ExactSearchOccurrence) => {
    if (!request) return;
    setNavigationFailure(false);
    try {
      if (await onNavigate(exactSearchNavigationIntent(occurrence, request))) return;
    } catch {
      // The local recovery below intentionally excludes filesystem details.
    }
    setNavigationFailure(true);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && search.isSettling) {
      event.preventDefault();
      search.submit();
      return;
    }
    if (occurrences.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, occurrences.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(occurrences.length - 1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + resultPageSize, occurrences.length - 1));
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - resultPageSize, 0));
    } else if (event.key === 'Enter' && occurrences[activeIndex]) {
      event.preventDefault();
      void open(occurrences[activeIndex]);
    }
  };

  return (
    <section aria-label="Exact workspace search" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-2 pb-2">
        <InputGroup className="w-full gap-0" ref={inputGroup} size="compact">
          <InputField
            aria-activedescendant={
              occurrences[activeIndex] ? `${resultsId}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={occurrences.length > 0 ? resultsId : undefined}
            aria-expanded={occurrences.length > 0}
            aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
            autoComplete="off"
            icon={Search}
            index={0}
            label="Search current workspace"
            labelHidden
            onChange={setQuery}
            onKeyDown={onInputKeyDown}
            placeholder="Search files"
            role="combobox"
            spellCheck={false}
            value={query}
          />
        </InputGroup>
      </div>

      {!request && (
        <p className="px-4 py-2 text-caption text-muted-foreground" role="status">
          Type to search exact text.
        </p>
      )}

      {request && searching && (
        <p className="px-4 py-2 text-caption text-muted-foreground" role="status">
          Searching…
        </p>
      )}

      {request && !searching && search.isError && (
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <p className="text-caption text-destructive" role="alert">
            Search is unavailable.
          </p>
          <Button onClick={() => void search.refetch()} size="compact" variant="tertiary">
            Retry
          </Button>
        </div>
      )}

      {request && !searching && search.isSuccess && files.length === 0 && (
        <p className="px-4 py-2 text-caption text-muted-foreground" role="status">
          No exact matches.
        </p>
      )}

      {request && !searching && occurrences.length > 0 && (
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
                      onClick={() => void open(occurrence)}
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

      {search.data?.truncated && !searching && (
        <p
          className="shrink-0 border-t border-border px-4 py-2 text-[10px] text-muted-foreground"
          role="status"
        >
          Showing the first results from {search.data.totalMatches.toLocaleString()} matches.
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

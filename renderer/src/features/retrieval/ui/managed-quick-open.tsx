import { ExternalLink } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { CommandInput, CommandItem, CommandList } from '@/components/ui/command-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import {
  quickOpenNavigationIntent,
  rankQuickOpenSources,
  type QuickOpenItem,
} from '@/features/retrieval/domain/quick-open';
import { cn } from '@/lib/utils';

import type { QuickOpenProps } from './quick-open-types';

const RESULT_LIMIT = 50;
const RESULT_PAGE_SIZE = 8;

function optionName(item: QuickOpenItem, folderName: string, revealLabel: string): string {
  const location = item.parentPath || folderName;
  const details = [location];
  if (item.retrievalAccess === 'excluded') {
    details.push('excluded from Search and automatic Chat context');
  }
  if (item.action === 'reveal') details.push(revealLabel);
  return `${item.basename}, ${details.join(', ')}`;
}

export default function ManagedQuickOpen({
  folderName,
  onClose,
  onNavigate,
  onRetry,
  revealLabel,
  sources,
  status,
}: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const resultsId = useId();
  const matches = useMemo(() => rankQuickOpenSources(sources, query), [query, sources]);
  const items = useMemo(() => matches.slice(0, RESULT_LIMIT), [matches]);
  const shortcut = useMemo(() => {
    if (typeof navigator === 'undefined') return 'Ctrl P';
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform || navigator.platform;
    return /mac/iu.test(platform) ? '⌘P' : 'Ctrl P';
  }, []);

  useEffect(() => setActiveIndex(0), [query, sources]);
  useEffect(() => searchField.current?.focus(), []);

  const accept = async (item: QuickOpenItem) => {
    if (pending) return;
    setFailure(null);
    setPending(true);
    try {
      if (await onNavigate(quickOpenNavigationIntent(item))) {
        onClose();
        return;
      }
      setFailure(
        item.action === 'open'
          ? 'Could not open this file. Your current document remains available.'
          : `Could not ${revealLabel.toLocaleLowerCase()}.`,
      );
    } catch {
      setFailure(
        item.action === 'open'
          ? 'Could not open this file. Your current document remains available.'
          : `Could not ${revealLabel.toLocaleLowerCase()}.`,
      );
    } finally {
      setPending(false);
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + RESULT_PAGE_SIZE, items.length - 1));
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - RESULT_PAGE_SIZE, 0));
    } else if (event.key === 'Enter' && items[activeIndex]) {
      event.preventDefault();
      void accept(items[activeIndex]);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent aria-label="Open file" closeDisabled={pending} presentation="command">
        <CommandInput
          aria-activedescendant={
            items[activeIndex] ? `${resultsId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={status === 'ready' && items.length > 0 ? resultsId : undefined}
          aria-expanded={status === 'ready' && items.length > 0}
          aria-keyshortcuts="Meta+P Control+P"
          aria-label="Search files"
          autoComplete="off"
          disabled={pending}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Open file…"
          role="combobox"
          ref={searchField}
          shortcut={shortcut}
          spellCheck={false}
          value={query}
        />

        {status === 'loading' && (
          <p className="px-4 py-3 text-caption text-muted-foreground" role="status">
            Loading files…
          </p>
        )}

        {status === 'unavailable' && (
          <div className="flex h-12 items-center justify-between gap-3 px-4">
            <p className="text-caption text-destructive" role="alert">
              Files are unavailable.
            </p>
            <Button onClick={onRetry} size="compact" variant="tertiary">
              Retry
            </Button>
          </div>
        )}

        {status === 'ready' && items.length === 0 && (
          <p className="px-4 py-3 text-caption text-muted-foreground" role="status">
            {query.trim() ? 'No matching files.' : 'This folder has no files.'}
          </p>
        )}

        {status === 'ready' && items.length > 0 && (
          <CommandList
            activeIndex={activeIndex}
            aria-label="Quick Open results"
            id={resultsId}
            onActiveIndexChange={setActiveIndex}
            role="listbox"
          >
            {items.map((item, index) => {
              const selected = index === activeIndex;
              const excluded = item.retrievalAccess === 'excluded';
              const location = item.parentPath || folderName;
              return (
                <CommandItem
                  active={selected}
                  aria-label={optionName(item, folderName, revealLabel)}
                  disabled={pending}
                  id={`${resultsId}-option-${index}`}
                  index={index}
                  key={`${item.source.folderPath}\u0000${item.source.path}`}
                  onClick={() => void accept(item)}
                >
                  <FileTypeIcon
                    aria-hidden="true"
                    className={cn(
                      'size-4 shrink-0',
                      excluded && !selected ? 'text-muted-foreground' : 'text-foreground',
                    )}
                    path={item.source.path}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      excluded && !selected ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {item.basename}
                  </span>
                  <span className="ml-auto flex max-w-[55%] min-w-0 items-center gap-2 text-caption text-muted-foreground">
                    {excluded && (
                      <span className="hidden shrink-0 sm:inline">Not in Search or Chat</span>
                    )}
                    <span className="truncate">{location}</span>
                    {item.action === 'reveal' && (
                      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                    )}
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
        )}

        {failure && (
          <p
            className="border-t border-border px-4 py-3 text-caption text-destructive"
            role="alert"
          >
            {failure}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

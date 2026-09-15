/**
 * The strip's New tab: a tab holding no document, opened from the plus at
 * the strip's end as a place to start from, the way an editor's empty tab
 * offers its first moves. It is window-local UI state rather than a member
 * of the open set: the runtime knows only documents, and the New tab lasts
 * exactly until a document comes in front of the reader, which is where
 * everything its page offers leads. It is never saved with the session.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface NewTab {
  /** Whether the strip carries the New tab, selected, and the card shows
   *  its page in place of the active document. */
  readonly open: boolean;
  /** The plus: opens the New tab, or leaves an open one as it is. */
  add(): void;
  /** The tab's close, or its page's: the active document shows again. */
  close(): void;
}

interface Opened {
  request: SourceReference | null;
  /** The document that was in front when the tab opened; another coming
   *  in front is what closes the tab. */
  behind: string | null;
  runtime: DocumentTabsRuntime;
}

export function useNewTab(runtime: DocumentTabsRuntime | null): NewTab {
  const subscribe = useCallback(
    (listener: () => void) => (runtime ? runtime.subscribe(listener) : () => undefined),
    [runtime],
  );
  const read = useCallback(() => runtime?.store.getState().activeTabId ?? null, [runtime]);
  const activeTabId = useSyncExternalStore(subscribe, read, read);
  const readRequest = useCallback(() => runtime?.store.getState().openRequest ?? null, [runtime]);
  const request = useSyncExternalStore(subscribe, readRequest, readRequest);
  const [opened, setOpened] = useState<Opened | null>(null);
  // Derived rather than effected, so the strip and the card never show a
  // document in front and the New tab selected on the same frame. A folder
  // change brings a new runtime, which drops the tab with the rest of the
  // window's document state.
  const open =
    opened !== null &&
    opened.runtime === runtime &&
    opened.request === request &&
    (activeTabId === null || activeTabId === opened.behind);
  useEffect(() => {
    // Once a document in front has closed the tab, the record is spent: the
    // same document returning must not bring the tab back.
    if (opened !== null && !open) setOpened(null);
  }, [open, opened]);
  const add = useCallback(() => {
    if (runtime) setOpened({ behind: activeTabId, request, runtime });
  }, [activeTabId, request, runtime]);
  const close = useCallback(() => setOpened(null), []);
  return { add, close, open };
}

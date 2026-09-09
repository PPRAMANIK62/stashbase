import type { ReactNode } from 'react';

import type { SearchNavigationIntent } from '@/features/retrieval/domain/exact-search';
import type { SemanticReadiness } from '@/features/retrieval/domain/semantic-readiness';
import type { DebouncedLane } from '@/features/retrieval/hooks/use-debounced-query';
import type { IconComponent } from '@/lib/icon-context';

/** What the reader asked for, plus the index state a backend may consult. */
export interface SearchRequestContext {
  readonly folderPath: string;
  /** Trimmed query text; a backend is never asked to run an empty one. */
  readonly query: string;
  readonly readiness: SemanticReadiness;
}

/** The list wiring a backend's rows render into. */
export interface SearchRowsView {
  readonly activeIndex: number;
  /** Opens row `index`; the same call Enter makes. */
  readonly onOpen: (index: number) => void;
  /** Element id for row `index`, which the query field points at. */
  readonly rowId: (index: number) => string;
}

/** One answer, already shaped for presentation. Rows are numbered in visual
 *  order, which is the order the keyboard walks. */
export interface SearchRows {
  readonly count: number;
  /** Where row `index` opens, or null when it cannot be opened. */
  readonly intent: (index: number) => SearchNavigationIntent | null;
  /** Footer sentence when the backend truncated its answer. */
  readonly note: string | null;
  readonly render: (view: SearchRowsView) => ReactNode;
}

/** One request in flight: its cache key and the call that answers it. The
 *  surface hands it straight to the debounced query it shares with every
 *  backend. */
export type SearchLane = DebouncedLane<SearchRows>;

/** How the AI Index gates a backend that depends on it. Only such a backend
 *  declares one; a backend that answers from the folder itself has no gate to
 *  stub out, and is therefore always ready. */
interface SearchIndexGate {
  /** Whether the backend can answer with the index in this state. */
  readonly ready: (readiness: SemanticReadiness) => boolean;
  /** Tab tooltip while the index cannot serve this backend. */
  readonly unavailableTitle: string;
}

/**
 * One way to search a folder. The surface renders its tab, its notices, and
 * its rows from this record alone, so a new way to search is one more entry
 * in the registry rather than another branch in the surface.
 */
export interface SearchBackend {
  /** How long a keystroke waits before it reaches the transport. */
  readonly delayMs: number;
  /** Shown when the backend answered with nothing. */
  readonly emptyMessage: string;
  readonly icon: IconComponent;
  readonly id: string;
  /** Shown while the backend is ready and the reader has typed nothing. */
  readonly idleMessage: string;
  /** Present only on a backend the AI Index gates. Its absence is the whole
   *  statement that this backend is never held back by the index — and it is
   *  what tells the surface whose reader needs the index notice. */
  readonly indexGate?: SearchIndexGate;
  readonly label: string;
  /** The lane for one request. Called only when the backend is ready and the
   *  query is non-empty. */
  readonly lane: (context: SearchRequestContext) => SearchLane;
  readonly placeholder: string;
  /** Accessible name of the result list. */
  readonly resultsLabel: string;
  /** Accessible name of the whole surface while this backend is selected. */
  readonly surfaceLabel: string;
  /** Tab tooltip while the backend can answer. */
  readonly tabTitle: string;
}

/** Whether the backend can answer at all right now. */
export function backendReady(backend: SearchBackend, readiness: SemanticReadiness): boolean {
  return backend.indexGate?.ready(readiness) ?? true;
}

/** The tab tooltip, which explains a gated backend that cannot answer. */
export function backendTabTitle(backend: SearchBackend, readiness: SemanticReadiness): string {
  const gate = backend.indexGate;
  return !gate || gate.ready(readiness) ? backend.tabTitle : gate.unavailableTitle;
}

/** A surface always has something to search with, so the registry carries
 *  its first entry in its type rather than leaving every caller to handle an
 *  empty list. */
export type SearchBackendRegistry = readonly [SearchBackend, ...SearchBackend[]];

/** The selected backend, falling back to the first so an id no longer in the
 *  registry still renders something. */
export function selectedBackend(backends: SearchBackendRegistry, id: string): SearchBackend {
  return backends.find((backend) => backend.id === id) ?? backends[0];
}

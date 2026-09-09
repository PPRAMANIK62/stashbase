/**
 * The Similar (meaning) search backend.
 *
 * It answers only while the folder's AI Index can serve a query, and its
 * readiness gate is the one place that decision is made: the surface asks
 * the backend, never the index status.
 */
import { Sparkles } from 'lucide-react';

import { CommandItem } from '@/components/ui/command-menu';
import type { SemanticSearchPort } from '@/features/retrieval/application/ports';
import { retrievalQueryKeys } from '@/features/retrieval/application/queries';
import { canSemanticSearch } from '@/features/retrieval/domain/semantic-readiness';
import {
  groupSemanticHits,
  semanticNavigationIntent,
  SEMANTIC_SEARCH_CANDIDATES,
  type SemanticHit,
  type SemanticSearchResult,
} from '@/features/retrieval/domain/semantic-search';

import type { SearchBackend, SearchRows } from './backend';
import { rowLabel, SourceName } from './row';

const SIMILAR_DELAY_MS = 250;

function hitLocation(hit: SemanticHit): string {
  if (hit.heading) return hit.heading;
  if (hit.pdfPage) return `Page ${hit.pdfPage}`;
  if (hit.startLine) return `Line ${hit.startLine}`;
  return '';
}

function similarRows(result: SemanticSearchResult): SearchRows {
  const hits = result.hits;
  const groups = groupSemanticHits(hits, 'folder');
  const indexOf = new Map(hits.map((hit, index) => [hit.id, index]));
  return {
    count: hits.length,
    intent: (index) => {
      const hit = hits[index];
      return hit ? semanticNavigationIntent(hit) : null;
    },
    note: result.truncated ? `Showing the strongest ${hits.length} results.` : null,
    render: (view) =>
      groups.map((group) => (
        <div key={group.folderPath}>
          {group.hits.map((hit) => {
            const index = indexOf.get(hit.id) ?? 0;
            const location = hitLocation(hit);
            return (
              <CommandItem
                aria-label={rowLabel(hit.source.path, location, hit.snippet || 'Similar source')}
                className="h-auto min-h-11 flex-col items-stretch gap-0.5 py-1.5"
                id={view.rowId(index)}
                key={hit.id}
                onClick={() => view.onOpen(index)}
              >
                <span className="flex min-w-0 items-center gap-2 text-caption">
                  <SourceName path={hit.source.path} />
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
      )),
  };
}

/** Similar search: folder-explicit, and gated on an AI Index that can answer
 *  now. A paused or building index that already serves part of the folder
 *  still answers; one that cannot serve anything does not send a request. */
export function similarSearchBackend(api: SemanticSearchPort): SearchBackend {
  return {
    delayMs: SIMILAR_DELAY_MS,
    emptyMessage: 'No similar results.',
    icon: Sparkles,
    id: 'similar',
    idleMessage: 'Type to search by meaning.',
    indexGate: {
      ready: canSemanticSearch,
      unavailableTitle: 'Match by meaning — needs AI Index',
    },
    label: 'Similar',
    lane: ({ folderPath, query }) => {
      const request = { folderPath, query, topK: SEMANTIC_SEARCH_CANDIDATES };
      return {
        fetch: async (signal) => similarRows(await api.search(request, signal)),
        key: retrievalQueryKeys.semantic(request),
      };
    },
    placeholder: 'Describe what you are looking for',
    resultsLabel: 'Similar results',
    surfaceLabel: 'Similar search',
    tabTitle: 'Match by meaning',
  };
}

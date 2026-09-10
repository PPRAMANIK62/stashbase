import { useMemo } from 'react';

import type {
  ExactSearchPort,
  IndexDecisionPort,
  SemanticSearchPort,
} from '@/features/retrieval/application/ports';
import type { SearchNavigationIntent } from '@/features/retrieval/domain/exact-search';
import type {
  PreparationCounts,
  SemanticReadiness,
} from '@/features/retrieval/domain/semantic-readiness';

import { searchBackends } from './search/backends';
import { SearchSurface } from './search/surface';

export interface LibrarySearchProps {
  active: boolean;
  activeFolderPath: string;
  decisionApi: IndexDecisionPort;
  exactApi: ExactSearchPort;
  focusRevision: number;
  onNavigate(intent: SearchNavigationIntent): Promise<boolean>;
  onOpenSettings(section: 'ai-index' | 'transcription'): void;
  preparation: PreparationCounts;
  readiness: SemanticReadiness;
  /** Visible sources already searchable, for the preparation line. */
  readyCount: number;
  semanticApi: SemanticSearchPort;
}

/** Search over the selected workspace folder, with the shipped set of search
 *  backends bound to their transports. */
export function LibrarySearch({
  activeFolderPath,
  exactApi,
  semanticApi,
  ...props
}: LibrarySearchProps) {
  const backends = useMemo(
    () => searchBackends({ exactApi, semanticApi }),
    [exactApi, semanticApi],
  );
  return <SearchSurface {...props} backends={backends} folderPath={activeFolderPath} />;
}

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

import { offeredBackends, searchBackends } from './search/backends';
import { SearchSurface } from './search/surface';

export interface ProjectSearchProps {
  active: boolean;
  activeFolderPath: string;
  decisionApi: IndexDecisionPort;
  exactApi: ExactSearchPort;
  focusRevision: number;
  onConfigureSearch?: (() => void) | undefined;
  onNavigate(intent: SearchNavigationIntent): Promise<boolean>;
  preparation: PreparationCounts;
  readiness: SemanticReadiness;
  /** Visible sources already searchable, for the preparation line. */
  readyCount: number;
  semanticApi: SemanticSearchPort;
}

/** Search over the selected workspace folder, with the shipped set of search
 *  backends bound to their transports. A backend the index gates is offered
 *  only once search by meaning is set up: until then the surface is keyword
 *  search alone, with no tab naming a mode the reader has not turned on. */
export function ProjectSearch({
  activeFolderPath,
  exactApi,
  semanticApi,
  ...props
}: ProjectSearchProps) {
  const backends = useMemo(
    () => searchBackends({ exactApi, semanticApi }),
    [exactApi, semanticApi],
  );
  const offered = useMemo(
    () => offeredBackends(backends, props.readiness),
    [backends, props.readiness],
  );
  return <SearchSurface {...props} backends={offered} folderPath={activeFolderPath} />;
}

import type { ExactSearchPort, SemanticSearchPort } from '@/features/retrieval/application/ports';

import type { SearchBackendRegistry } from './backend';
import { exactSearchBackend } from './exact-backend';
import { similarSearchBackend } from './similar-backend';

export interface SearchBackendApis {
  readonly exactApi: ExactSearchPort;
  readonly semanticApi: SemanticSearchPort;
}

/** The ways a reader can search a folder, in tab order. Adding one is an
 *  entry here; the surface renders whatever this list contains. */
export function searchBackends({
  exactApi,
  semanticApi,
}: SearchBackendApis): SearchBackendRegistry {
  return [exactSearchBackend(exactApi), similarSearchBackend(semanticApi)];
}

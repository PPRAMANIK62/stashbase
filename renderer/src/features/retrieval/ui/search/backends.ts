import type { ExactSearchPort, SemanticSearchPort } from '@/features/retrieval/application/ports';
import type { SemanticReadiness } from '@/features/retrieval/domain/semantic-readiness';

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

/** The backends a reader is shown. A gated backend exists only once search by
 *  meaning is set up; while it is not, or while that is still unknown, the
 *  list is the ungated backends alone, so no tab names a mode the reader did
 *  not turn on. The first backend is never gated, so the list stays non-empty. */
export function offeredBackends(
  backends: SearchBackendRegistry,
  readiness: SemanticReadiness,
): SearchBackendRegistry {
  if (readiness.state !== 'not-set-up' && readiness.state !== 'unknown') return backends;
  const [first, ...rest] = backends;
  return [first, ...rest.filter((backend) => backend.indexGate === undefined)];
}

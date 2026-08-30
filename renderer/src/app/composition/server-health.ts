import { createServerHealthAdapter } from '../bootstrap/server-health-adapter';
import { createGetJson } from '../../platform/api/get-json';

export function createServerHealthReader(fetchImplementation: typeof fetch) {
  const readHealth = createServerHealthAdapter(createGetJson(fetchImplementation));
  return (signal: AbortSignal) => readHealth({}, signal);
}

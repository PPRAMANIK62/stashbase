import { vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

/** A transport that answers every request with the same body and status.
 *  Infrastructure tests use it to prove what an adapter makes of a response,
 *  and to assert the request it sent. */
export function httpClient(body: unknown = null, status = 200): HttpClient {
  return { request: vi.fn(async () => ({ body, status })) };
}

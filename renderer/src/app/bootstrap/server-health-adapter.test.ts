import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { createServerHealthReader } from '../composition/server-health';
import { createServerHealthAdapter } from './server-health-adapter';

function fixture(name: string): unknown {
  const fixturePath = path.resolve(process.cwd(), '../shared/protocols/http/fixtures', name);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

const invalidJsonFetch: typeof fetch = async () =>
  new Response('not-json', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('server health adapter', () => {
  it('validates compatible responses and maps only safe readiness state', async () => {
    for (const body of [
      fixture('server-health-v1.json'),
      fixture('server-health-v1-forward.json'),
    ]) {
      const requests: string[] = [];
      const readHealth = createServerHealthAdapter(async (requestPath) => {
        requests.push(requestPath);
        return { kind: 'response', status: 200, body };
      });

      await expect(readHealth({}, signal())).resolves.toEqual({
        ok: true,
        value: { protocolVersion: 1 },
      });
      expect(requests).toEqual(['/api/health']);
    }
  });

  it('maps a validated wire failure into the shared recovery vocabulary', async () => {
    const body = fixture('server-health-v1-failure.json');
    const readHealth = createServerHealthAdapter(async () => ({
      kind: 'response',
      status: 503,
      body,
    }));

    const result = await readHealth({}, signal());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a classified health failure');
    expect(result.failure).toEqual({
      kind: 'unavailable',
      message: 'The local server is not ready.',
      cause: body,
    });
  });

  it('rejects incompatible payloads and invalid JSON', async () => {
    const transport = async () => ({
      kind: 'response' as const,
      status: 200,
      body: fixture('server-health-incompatible.json'),
    });
    const readHealth = createServerHealthAdapter(transport);

    const incompatible = await readHealth({}, signal());
    expect(incompatible.ok).toBe(false);
    if (incompatible.ok) throw new Error('expected an invalid response failure');
    expect(incompatible.failure.kind).toBe('invalid-response');

    const syntaxError = new SyntaxError('invalid JSON');
    const invalidJson = createServerHealthAdapter(async () => ({
      kind: 'invalid-response',
      status: 200,
      cause: syntaxError,
    }));
    const invalidJsonResult = await invalidJson({}, signal());
    expect(invalidJsonResult.ok).toBe(false);
    if (invalidJsonResult.ok) throw new Error('expected an invalid JSON failure');
    expect(invalidJsonResult.failure).toEqual({
      kind: 'invalid-response',
      message: 'The local server returned invalid JSON.',
      cause: syntaxError,
    });
  });

  it('classifies transport cancellation, unavailability, and HTTP authorization', async () => {
    const networkError = new Error('connection refused');
    const unavailable = createServerHealthAdapter(async () => {
      throw networkError;
    });
    const unavailableResult = await unavailable({}, signal());
    expect(unavailableResult.ok).toBe(false);
    if (unavailableResult.ok) throw new Error('expected an unavailable failure');
    expect(unavailableResult.failure.kind).toBe('unavailable');
    expect(unavailableResult.failure.cause).toBe(networkError);

    const controller = new AbortController();
    controller.abort();
    const cancelled = createServerHealthAdapter(async () => {
      throw new Error('aborted');
    });
    const cancelledResult = await cancelled({}, controller.signal);
    expect(cancelledResult.ok).toBe(false);
    if (cancelledResult.ok) throw new Error('expected a cancelled failure');
    expect(cancelledResult.failure.kind).toBe('cancelled');

    const unauthorized = createServerHealthAdapter(async () => ({
      kind: 'response',
      status: 403,
      body: { error: 'cross-origin request rejected', code: 'BAD_ORIGIN' },
    }));
    const unauthorizedResult = await unauthorized({}, signal());
    expect(unauthorizedResult.ok).toBe(false);
    if (unauthorizedResult.ok) throw new Error('expected an unauthorized failure');
    expect(unauthorizedResult.failure.kind).toBe('unauthorized');
  });

  it('composes the production JSON transport with runtime validation', async () => {
    const current = fixture('server-health-v1.json');
    const fetchImplementation: typeof fetch = async () =>
      new Response(JSON.stringify(current), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const readHealth = createServerHealthReader(fetchImplementation);

    await expect(readHealth(signal())).resolves.toEqual({
      ok: true,
      value: { protocolVersion: 1 },
    });

    const invalidJson = await createServerHealthReader(invalidJsonFetch)(signal());
    expect(invalidJson.ok).toBe(false);
    if (invalidJson.ok) throw new Error('expected the composed transport to reject invalid JSON');
    expect(invalidJson.failure.kind).toBe('invalid-response');
  });
});

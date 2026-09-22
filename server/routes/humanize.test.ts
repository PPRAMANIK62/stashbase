import assert from 'node:assert/strict';
import { test } from 'node:test';

import express from 'express';

import { HUMANIZE_TEXT_LIMIT } from '../../shared/protocols/http/humanize.ts';
import { mount, type HumanizeRouteDependencies } from './humanize.ts';

async function withRoute<T>(
  humanize: HumanizeRouteDependencies['humanize'],
  run: (url: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  mount(app, { humanize });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await run(`http://127.0.0.1:${port}/api/humanize`);
  } finally {
    server.close();
  }
}

const post = (url: string, body: unknown) =>
  fetch(url, { body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method: 'POST' });

test('the route answers the whole rewrite for a selection within the limit', async () => {
  const seen: unknown[] = [];
  const response = await withRoute(
    async (input) => {
      seen.push(input);
      return { text: 'A plain line.' };
    },
    (url) => post(url, { text: '  A line, comprehensively.  ' }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: 'A plain line.' });
  assert.deepEqual(seen, [{ text: 'A line, comprehensively.' }]);
});

test('the route refuses an over-long selection with 413 before spending a request on it', async () => {
  let called = false;
  const response = await withRoute(
    async () => {
      called = true;
      return { text: 'never' };
    },
    (url) => post(url, { text: 'x'.repeat(HUMANIZE_TEXT_LIMIT + 1) }),
  );
  assert.equal(response.status, 413);
  assert.equal(((await response.json()) as { code?: string }).code, 'HUMANIZE_TOO_LONG');
  assert.equal(called, false);
});

test('the route refuses a malformed body with 400 and passes a service refusal through by status', async () => {
  const malformed = await withRoute(
    async () => ({ text: 'never' }),
    (url) => post(url, { note: 'no text' }),
  );
  assert.equal(malformed.status, 400);

  const busy = await withRoute(
    async () => {
      throw Object.assign(new Error('The rewrite service is busy right now.'), { status: 429, code: 'HUMANIZE_BUSY' });
    },
    (url) => post(url, { text: 'A line.' }),
  );
  assert.equal(busy.status, 429);
  assert.deepEqual(await busy.json(), { error: 'The rewrite service is busy right now.', code: 'HUMANIZE_BUSY' });
});

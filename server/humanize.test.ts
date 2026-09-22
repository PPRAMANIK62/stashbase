import assert from 'node:assert/strict';
import { test } from 'node:test';

import { humanizeText, type HumanizeDependencies } from './humanize.ts';

interface Captured {
  body: unknown;
  headers: Headers;
  method: string | undefined;
  redirect: RequestInit['redirect'];
  url: string;
}

function stream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const event = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

function serviceWith(
  answer: (captured: Captured) => Response | Promise<Response>,
): { dependencies: HumanizeDependencies; calls: Captured[] } {
  const calls: Captured[] = [];
  return {
    calls,
    dependencies: {
      clientVersion: () => '9.9.9-test',
      fetch: async (input, init) => {
        const captured: Captured = {
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
          headers: new Headers(init?.headers),
          method: init?.method,
          redirect: init?.redirect,
          url: String(input),
        };
        calls.push(captured);
        return answer(captured);
      },
      upstreamUrl: 'https://site.invalid/api/rewrite',
    },
  };
}

async function refusalOf(run: Promise<unknown>): Promise<{ code: unknown; message: string; status: unknown }> {
  try {
    await run;
  } catch (error: unknown) {
    const { code, status } = error as { code?: unknown; status?: unknown };
    return { code, message: error instanceof Error ? error.message : String(error), status };
  }
  assert.fail('expected a refusal');
}

test('humanize drains the rewrite stream whole and sends the request the Worker expects', async () => {
  const { calls, dependencies } = serviceWith(
    () =>
      new Response(
        stream(
          // Thinking has its own field and never reaches the text.
          event({ choices: [{ delta: { reasoning_content: 'hmm' } }] }),
          // A chunk boundary inside an event line must not split the JSON.
          `data: {"choices":[{"delta":{"content":"\\n\\nA plain "}}]}\n\n${'data: {"choices":[{"delta":{"con'}`,
          `tent":"line."},"finish_reason":null}]}\n\n`,
          event({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
          'data: [DONE]\n\n',
        ),
        { headers: { 'content-type': 'text/event-stream' } },
      ),
  );

  const result = await humanizeText({ text: 'A line, comprehensively.' }, undefined, dependencies);

  assert.deepEqual(result, { text: 'A plain line.' });
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.url, 'https://site.invalid/api/rewrite');
  assert.equal(call.method, 'POST');
  assert.equal(call.redirect, 'error');
  assert.deepEqual(call.body, { text: 'A line, comprehensively.', note: '' });
  assert.equal(call.headers.get('content-type'), 'application/json');
  assert.equal(call.headers.get('x-stashbase-client-version'), '9.9.9-test');
  // The Worker refuses cross-site browsers by their Origin; the host is not one.
  assert.equal(call.headers.get('origin'), null);
  assert.equal(call.headers.get('authorization'), null);
});

test('humanize refuses a rewrite the service cut off rather than offering most of one', async () => {
  const { dependencies } = serviceWith(
    () =>
      new Response(
        stream(
          event({ choices: [{ delta: { content: 'A plain line that goes on' } }] }),
          event({ choices: [{ delta: {}, finish_reason: 'length' }] }),
          'data: [DONE]\n\n',
        ),
      ),
  );

  const refusal = await refusalOf(humanizeText({ text: 'A long line.' }, undefined, dependencies));
  assert.equal(refusal.status, 422);
  assert.equal(refusal.code, 'HUMANIZE_CUT_OFF');
});

for (const scenario of [
  { status: 429, body: { error: 'rate_limited' }, expected: { status: 429, code: 'HUMANIZE_BUSY' } },
  { status: 429, body: { error: 'busy' }, expected: { status: 429, code: 'HUMANIZE_BUSY' } },
  { status: 413, body: { error: 'too_long' }, expected: { status: 413, code: 'HUMANIZE_TOO_LONG' } },
  { status: 400, body: { error: 'bad_request' }, expected: { status: 413, code: 'HUMANIZE_TOO_LONG' } },
  { status: 503, body: { error: 'not_configured' }, expected: { status: 503, code: 'HUMANIZE_UNAVAILABLE' } },
  { status: 502, body: { error: 'upstream_error' }, expected: { status: 503, code: 'HUMANIZE_UNAVAILABLE' } },
  { status: 403, body: 'forbidden', expected: { status: 503, code: 'HUMANIZE_UNAVAILABLE' } },
]) {
  test(`humanize maps a ${scenario.status} ${JSON.stringify(scenario.body)} refusal onto the route's ladder`, async () => {
    const { dependencies } = serviceWith(
      () =>
        new Response(typeof scenario.body === 'string' ? scenario.body : JSON.stringify(scenario.body), {
          status: scenario.status,
        }),
    );
    const refusal = await refusalOf(humanizeText({ text: 'A line.' }, undefined, dependencies));
    assert.equal(refusal.status, scenario.expected.status);
    assert.equal(refusal.code, scenario.expected.code);
  });
}

test('humanize reports an unreachable or empty service as unavailable, never as a rewrite', async () => {
  const unreachable = serviceWith(() => {
    throw new TypeError('fetch failed');
  });
  const down = await refusalOf(humanizeText({ text: 'A line.' }, undefined, unreachable.dependencies));
  assert.equal(down.status, 503);
  assert.equal(down.code, 'HUMANIZE_UNAVAILABLE');

  const empty = serviceWith(
    () => new Response(stream(event({ choices: [{ delta: { content: '  \n' }, finish_reason: 'stop' }] }), 'data: [DONE]\n\n')),
  );
  const blank = await refusalOf(humanizeText({ text: 'A line.' }, undefined, empty.dependencies));
  assert.equal(blank.status, 503);
  assert.equal(blank.code, 'HUMANIZE_UNAVAILABLE');
});

test('a caller abort surfaces as the abort itself, not as a service failure', async () => {
  const controller = new AbortController();
  const { dependencies } = serviceWith(async (captured) => {
    controller.abort();
    // The fetch honours the signal it was handed, as the real one would.
    throw new DOMException('This operation was aborted', 'AbortError');
    return new Response(String(captured.url));
  });
  await assert.rejects(
    humanizeText({ text: 'A line.' }, controller.signal, dependencies),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  );
});

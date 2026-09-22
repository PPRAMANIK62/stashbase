/**
 * Humanize: one selection of prose rewritten by Hemmingway-1.
 *
 * The rewrite runs on the website's Worker at stashbase.ai, the same
 * endpoint the public humanizer at /tools/humanizer/ uses, so the model, the
 * instruction and the spending cap live in one place and this module carries
 * no credential. That is a staging choice, not a destination: the hosted
 * Agent gateway meters by account and this endpoint meters by visitor IP.
 * When the rewrite should count against an account, this is the one module
 * that moves; the route, the renderer and the review stay as they are.
 *
 * The Worker streams the reply as OpenAI-style server-sent events. The
 * renderer wants the whole rewrite, because it becomes a revision proposal,
 * and a proposal missing its tail would delete the reader's own tail on
 * accept. So the stream is drained here, and a reply the service cut short at
 * its token limit is refused rather than handed over.
 */
import { stashbaseClientVersion } from './hosted-account.ts';
import { errorMessage, logger } from './log.ts';

const log = logger('humanize');

export const HUMANIZE_UPSTREAM_URL = 'https://stashbase.ai/api/rewrite';

/** Thinking runs before the first token and a long paragraph takes a while
 *  to stream. The website's page waits as long as the visitor does; a host
 *  route should not hold a socket forever. */
const UPSTREAM_TIMEOUT_MS = 120_000;

export interface HumanizeInput {
  text: string;
  note?: string | undefined;
}

export interface HumanizeDependencies {
  clientVersion: () => string;
  fetch: typeof fetch;
  upstreamUrl: string;
}

const defaults: HumanizeDependencies = {
  clientVersion: stashbaseClientVersion,
  fetch: (input, init) => fetch(input, init),
  upstreamUrl: HUMANIZE_UPSTREAM_URL,
};

/** A refusal the route can answer with. 429, 413 and 422 are the statuses
 *  the renderer reads on its own ladder; everything else is the capability
 *  being unavailable, which is what 503 says. */
function refusal(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code });
}

const unavailable = (message: string) => refusal(message, 503, 'HUMANIZE_UNAVAILABLE');

/** The Worker answers a refusal as `{ error: '<code>' }`. Its codes are
 *  mapped, not forwarded: the route's contract is the status. */
function upstreamRefusal(status: number, body: string): Error {
  let code = '';
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && 'error' in parsed) code = String(parsed.error ?? '');
  } catch {
    // Not JSON: the status alone decides.
  }
  if (status === 429) {
    return refusal(
      code === 'busy'
        ? 'The rewrite service is busy right now.'
        : 'Too many rewrites in a row; wait a minute before the next one.',
      429,
      'HUMANIZE_BUSY',
    );
  }
  if (status === 400 || status === 413) {
    return refusal('The selection is too long to rewrite.', 413, 'HUMANIZE_TOO_LONG');
  }
  return unavailable(`The rewrite service is unavailable (HTTP ${status}${code ? `, ${code}` : ''}).`);
}

interface Drained {
  finish: string;
  text: string;
}

/** Drains an OpenAI-style event stream into the reply's text and its finish
 *  reason. Thinking arrives in its own delta fields and is dropped: the
 *  reader asked for a rewrite, not for the model's notes on it. */
async function drain(body: ReadableStream<Uint8Array>): Promise<Drained> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  let text = '';
  let finish = '';
  const consume = (line: string): boolean => {
    if (!line.startsWith('data:')) return false;
    const data = line.slice(5).trim();
    if (data === '[DONE]') return true;
    let choice: { delta?: { content?: unknown }; finish_reason?: unknown } | undefined;
    try {
      choice = (JSON.parse(data) as { choices?: Array<typeof choice> }).choices?.[0];
    } catch {
      return false;
    }
    if (typeof choice?.finish_reason === 'string') finish = choice.finish_reason;
    if (typeof choice?.delta?.content === 'string') text += choice.delta.content;
    return false;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (consume(line)) return { finish, text };
    }
    buffer += decoder.decode();
    consume(buffer);
    return { finish, text };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Hemmingway-1's plain rewrite of `input.text`, whole.
 *
 * A caller's abort rejects with the abort itself, so a client that went away
 * is not logged as a service failure. Every other failure is a refusal with
 * the status the route answers.
 */
export async function humanizeText(
  input: HumanizeInput,
  signal?: AbortSignal,
  dependencies: HumanizeDependencies = defaults,
): Promise<{ text: string }> {
  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let response: Response;
  try {
    response = await dependencies.fetch(dependencies.upstreamUrl, {
      body: JSON.stringify({ text: input.text, note: input.note ?? '' }),
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        'x-stashbase-client-version': dependencies.clientVersion(),
      },
      method: 'POST',
      redirect: 'error',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error: unknown) {
    if (signal?.aborted) throw error;
    log.warn('rewrite service unreachable:', errorMessage(error));
    throw unavailable('The rewrite service could not be reached.');
  }
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    log.warn(`rewrite service refused (HTTP ${response.status}):`, body.slice(0, 200));
    throw upstreamRefusal(response.status, body);
  }
  let drained: Drained;
  try {
    drained = await drain(response.body);
  } catch (error: unknown) {
    if (signal?.aborted) throw error;
    log.warn('rewrite stream ended early:', errorMessage(error));
    throw unavailable('The rewrite stream ended before the rewrite did.');
  }
  if (drained.finish === 'length') {
    throw refusal('The rewrite was cut off at the service\'s length limit.', 422, 'HUMANIZE_CUT_OFF');
  }
  const text = drained.text.trim();
  if (text === '') throw unavailable('The rewrite service answered with no text.');
  return { text };
}

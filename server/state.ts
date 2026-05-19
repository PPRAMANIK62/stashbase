/**
 * Process-wide indexer state + space-switch orchestration.
 *
 * One `MfsIndexer` instance lives for the lifetime of the server
 * process. Switching spaces flows through `scheduleIndexerSync` —
 * queued so back-to-back switches don't race, no-ops if the user
 * already moved on by the time the binding finishes.
 *
 * Extracted from `server/index.ts` so route modules can import the
 * indexer without picking up the whole route registration kitchen sink.
 */
import { MfsIndexer } from './indexer.mfs.ts';
import type { Indexer, EmbedderRuntimeConfig } from './indexer.ts';
import {
  getApiKey,
  getCurrentSpace,
  getSpaceEmbedderProvider,
  lockInSpaceProvider,
  onSwitch,
} from './space.ts';
import { syncNewFiles } from './sync.ts';
import { logger, errorMessage } from './log.ts';

const log = logger('state');

/** Single indexer instance shared across every route. */
export const indexer: Indexer = new MfsIndexer();

/** Resolve a space's runtime embedder config from disk. Returns null
 *  when the resolved provider can't be used right now (openai without
 *  a global key) so the caller can fall back to local. */
export function resolveSpaceEmbedder(spaceRoot: string): EmbedderRuntimeConfig | null {
  const provider = getSpaceEmbedderProvider(spaceRoot);
  if (provider === 'onnx') return { provider: 'onnx' };
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return { provider: 'openai', apiKey };
}

/** Bind the indexer to a space: apply that space's provider on the
 *  daemon (no-op if it's already loaded) then set_space. Centralises
 *  the "embed-then-bind" order so callers can't accidentally invert it
 *  and create a dim mismatch. */
export async function bindIndexerForSpace(spaceRoot: string): Promise<void> {
  // Persist the resolved provider on first bind so a later key change
  // doesn't silently flip an already-indexed space.
  lockInSpaceProvider(spaceRoot);
  const runtime = resolveSpaceEmbedder(spaceRoot);
  if (runtime) {
    await indexer.setEmbedder(runtime);
  } else {
    // openai configured but key gone: fall back to local so the space
    // is still searchable. Doesn't mutate the persisted provider — the
    // user's intent is preserved, just stalled.
    log.warn(`embedder: space ${spaceRoot} wants openai but no global key; falling back to local`);
    await indexer.setEmbedder({ provider: 'onnx' });
  }
  await indexer.setSpace(spaceRoot);
}

// Serialise indexer bind + sync so rapid space switches don't race. The
// seq guard short-circuits a stale tail when the user has already moved
// on; the queue chains each switch after the previous one finishes.
let indexerSwitchSeq = 0;
let indexerSwitchQueue: Promise<void> = Promise.resolve();

export function scheduleIndexerSync(spaceRoot: string, reason: string): void {
  const seq = ++indexerSwitchSeq;
  indexerSwitchQueue = indexerSwitchQueue
    .catch(() => undefined)
    .then(async () => {
      if (getCurrentSpace() !== spaceRoot) return;
      try {
        await bindIndexerForSpace(spaceRoot);
        if (getCurrentSpace() !== spaceRoot || seq !== indexerSwitchSeq) return;
        // Name-only diff: trust existing rows, only embed new files
        // and drop orphans. Reopening a fully-indexed space costs
        // zero tokens. The full content-hash diff lives behind the
        // manual /api/sync button (`syncIndex`) for the rare case
        // where the user edited files externally with the app closed.
        await syncNewFiles(indexer);
      } catch (err: unknown) {
        log.warn(`${reason}: index sync failed for ${spaceRoot}: ${errorMessage(err)}`);
      }
    });
}

// Fire a queued bind + sync on every space switch. Registered at module
// load time so any importer (index.ts, tests) gets the wiring for free.
onSwitch((newRoot) => {
  // Opening a space should feel instant; Python/MFS startup, embedder
  // swap, Milvus binding, and disk reconciliation continue in the
  // background while the UI lists files from disk immediately.
  scheduleIndexerSync(newRoot, 'space switch');
});

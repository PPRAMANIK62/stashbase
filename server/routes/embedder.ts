/**
 * Embedder routes: pick / change the per-space embedding provider,
 * manage the global OpenAI key, validate a key without persisting it,
 * estimate the re-embed cost of a provider switch.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { HIDDEN_DOT_DIRS } from '../files.ts';
import { logger, errorMessage } from '../log.ts';
import {
  getApiKey,
  getCurrentSpace,
  getSpaceEmbedderProvider,
  setApiKey,
  setSpaceEmbedderProvider,
  type EmbedderProvider,
} from '../space.ts';
import { syncIndex } from '../sync.ts';
import { indexer, bindIndexerForSpace } from '../state.ts';
import { sendError, validateOpenAIKey } from '../http.ts';

const log = logger('routes/embedder');

export function mount(app: express.Express): void {
  // Per-space provider + global API key. The provider is baked into a
  // space's Milvus collection at creation time, so switching a space
  // invalidates *its* index (and only its).
  app.get('/api/embedder', (_req, res) => {
    const cur = getCurrentSpace();
    if (!cur) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    res.json({
      provider: getSpaceEmbedderProvider(cur),
      // hasKey is global (one key per user across all spaces).
      hasKey: !!getApiKey(),
    });
  });

  // Change the global OpenAI key WITHOUT touching providers / spaces.
  // Validates the new key first so a typo can't blow away a working
  // one. If the current space happens to be on OpenAI, hot-swap the
  // daemon's embedder so subsequent embed calls use the new key —
  // same dimension, no re-embed needed.
  app.put('/api/embedder/key', async (req, res) => {
    const key = typeof req.body?.openaiKey === 'string' ? req.body.openaiKey.trim() : '';
    if (!key) return res.status(400).json({ error: 'openaiKey required' });
    const check = await validateOpenAIKey(key);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    setApiKey(key);
    const cur = getCurrentSpace();
    if (cur && getSpaceEmbedderProvider(cur) === 'openai') {
      try {
        await indexer.setEmbedder({ provider: 'openai', apiKey: key });
      } catch (err: unknown) {
        log.warn(`key rotate: daemon hot-swap failed: ${errorMessage(err)}`);
      }
    }
    res.json({ hasKey: true });
  });

  // Wipe the global OpenAI key. Spaces still configured as `openai`
  // won't be re-embedded automatically — their stored vectors stay
  // valid but new embed / search calls will fail until either a key
  // is added back or the space is switched to Local.
  app.delete('/api/embedder/key', (_req, res) => {
    setApiKey(undefined);
    res.json({ hasKey: false });
  });

  // Validate an OpenAI key without persisting it. Uses the standard
  // envelope: 200 + `{}` on valid, 4xx + `{ error }` on invalid — the
  // client `ApiError` throws on non-2xx so the caller's catch fires.
  app.post('/api/embedder/validate', async (req, res) => {
    const provider = typeof req.body?.provider === 'string' ? req.body.provider : 'openai';
    const key = typeof req.body?.openaiKey === 'string' ? req.body.openaiKey.trim() : '';
    if (provider !== 'openai') return res.json({});
    if (!key) return res.status(400).json({ error: 'openaiKey required' });
    const check = await validateOpenAIKey(key);
    if (check.ok) return res.json({});
    res.status(check.status).json({ error: check.error });
  });

  // Switch the embedder *for the current space*. On success: the
  // space's Milvus DB is wiped (mismatched dim), the daemon is re-bound
  // to the new provider, and the space is re-synced from disk in the
  // background. Other spaces are unaffected — they keep their own
  // per-space provider.
  app.put('/api/embedder', async (req, res) => {
    const cur = getCurrentSpace();
    if (!cur) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    const provider: EmbedderProvider | undefined = req.body?.provider;
    if (provider !== 'onnx' && provider !== 'openai') {
      return res.status(400).json({ error: 'provider must be "onnx" or "openai"' });
    }
    const rawKey = typeof req.body?.openaiKey === 'string' ? req.body.openaiKey.trim() : '';
    if (rawKey) setApiKey(rawKey);
    const apiKey = getApiKey();
    if (provider === 'openai' && !apiKey) {
      return res.status(400).json({ error: 'openaiKey required for openai provider' });
    }
    try {
      // Drop the collection from Milvus *and* release the flock before
      // wiping the on-disk DB. `closeStore` alone leaves pymilvus's
      // in-process schema cache populated; the next `connect()` then
      // sees the old dim and rejects the new embedder with a mismatch.
      await indexer.dropStore();
      wipeSpaceMilvus(cur);
      setSpaceEmbedderProvider(cur, provider);
      await bindIndexerForSpace(cur);
      syncIndex(indexer).catch((err) =>
        log.warn(`embedder: post-switch sync failed: ${errorMessage(err)}`),
      );
      res.json({ provider, hasKey: !!apiKey });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Cost estimate for switching the *current* space to a given provider.
  // Walks the space's content on disk (without going through the daemon)
  // and reports a rough token + USD estimate so the UI can show
  // "switching this space will cost about $X" before the user confirms.
  //
  // Tokens are estimated as bytes/4 — accurate for English, too low for
  // CJK by ~2× (where 3 UTF-8 bytes can be 1-2 tokens). Acceptable: the
  // number is labelled "estimate" and the goal is order-of-magnitude.
  app.get('/api/embedder/cost-estimate', (req, res) => {
    const cur = getCurrentSpace();
    if (!cur) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    const provider = typeof req.query.provider === 'string' ? req.query.provider : 'openai';
    let files = 0;
    let bytes = 0;
    try {
      walkSpaceForCost(cur, (size) => { files++; bytes += size; });
    } catch (err: unknown) {
      log.warn(`cost-estimate: failed to walk ${cur}: ${errorMessage(err)}`);
    }
    const tokens = Math.ceil(bytes / 4);
    // text-embedding-3-small is $0.02 per 1M input tokens. Hardcoded
    // because the model itself is hardcoded for v1; revisit when we
    // expose model selection.
    const costUsd = provider === 'openai' ? (tokens * 0.02) / 1_000_000 : 0;
    res.json({ provider, files, bytes, tokens, costUsd });
  });
}

/** Walk a space directory and report each indexable file's size.
 *  Skips `.stashbase/` (our sidecar dir) and load-bearing hidden dirs.
 *  Synchronous fs.readdirSync is fine — invoked at most once per click. */
function walkSpaceForCost(root: string, onFile: (size: number) => void): void {
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      // Same visibility rule as the sidebar tree (`files.ts:walk`) —
      // hide only the load-bearing internals so cost-estimate counts
      // every file the indexer will actually embed (`.claude/*.md`
      // slash commands included).
      if (e.name.startsWith('.') && HIDDEN_DOT_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        const lower = e.name.toLowerCase();
        if (lower.endsWith('.md') || lower.endsWith('.html') || lower.endsWith('.htm')) {
          try { onFile(fs.statSync(full).size); } catch { /* unreadable — skip */ }
        }
      }
    }
  }
}

/** Drop the given space's Milvus DB so it rebuilds at the new embedder's
 *  dim on next open. */
function wipeSpaceMilvus(spaceRoot: string): void {
  const dir = path.join(spaceRoot, '.stashbase', 'mfs');
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err: unknown) {
    log.warn(`embedder: failed to wipe ${dir}: ${errorMessage(err)}`);
  }
}

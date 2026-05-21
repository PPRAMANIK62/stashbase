/**
 * Embedder routes: pick / change the per-space embedding provider,
 * manage the global OpenAI key, validate a key without persisting it,
 * estimate the re-embed cost of a provider switch.
 *
 * Multi-collection model: switching a space's provider does NOT drop
 * any data. The daemon owns one DB at kbRoot with one collection per
 * (provider, dim); `bind_space` registers which collection a space's
 * future writes go to. After a switch:
 *   - Already-indexed files stay in their OLD collection, still
 *     searchable across the library via the same Milvus DB.
 *   - New / re-saved files write to the NEW collection.
 *   - A follow-up syncIndex re-embeds existing rows under the new
 *     provider — fire-and-forget so the UI stays responsive.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { HIDDEN_DOT_DIRS } from '../files.ts';
import { logger, errorMessage } from '../log.ts';
import {
  getApiKey,
  getCurrentSpace,
  getCurrentSpaceName,
  getSpaceEmbedderProvider,
  setApiKey,
  setSpaceEmbedderProvider,
  type EmbedderProvider,
} from '../space.ts';
import { syncIndex } from '../sync.ts';
import { indexer, bindIndexerForSpace, resolveSpaceEmbedder } from '../state.ts';
import { sendError, validateOpenAIKey } from '../http.ts';

const log = logger('routes/embedder');

export function mount(app: express.Express): void {
  // Per-space provider + global API key. The provider determines which
  // collection a space's NEW writes go to; existing rows in the old
  // collection stay searchable.
  app.get('/api/embedder', (_req, res) => {
    const cur = getCurrentSpace();
    if (!cur) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    res.json({
      provider: getSpaceEmbedderProvider(cur),
      hasKey: !!getApiKey(),
    });
  });

  // Change the global OpenAI key WITHOUT touching providers / spaces.
  // Validates the new key first so a typo can't blow away a working
  // one. If the current space is on OpenAI, we re-bind so the daemon
  // picks up the new key for subsequent embeds (same dim, no data
  // movement).
  app.put('/api/embedder/key', async (req, res) => {
    const key = typeof req.body?.openaiKey === 'string' ? req.body.openaiKey.trim() : '';
    if (!key) return res.status(400).json({ error: 'openaiKey required' });
    const check = await validateOpenAIKey(key);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    setApiKey(key);
    const cur = getCurrentSpace();
    if (cur && getSpaceEmbedderProvider(cur) === 'openai') {
      try {
        await bindIndexerForSpace(cur);
      } catch (err: unknown) {
        log.warn(`key rotate: rebind failed: ${errorMessage(err)}`);
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

  // Validate an OpenAI key without persisting it.
  app.post('/api/embedder/validate', async (req, res) => {
    const provider = typeof req.body?.provider === 'string' ? req.body.provider : 'openai';
    const key = typeof req.body?.openaiKey === 'string' ? req.body.openaiKey.trim() : '';
    if (provider !== 'openai') return res.json({});
    if (!key) return res.status(400).json({ error: 'openaiKey required' });
    const check = await validateOpenAIKey(key);
    if (check.ok) return res.json({});
    res.status(check.status).json({ error: check.error });
  });

  // Switch the embedder for the current space. Re-binds to the new
  // provider's collection — existing rows stay in the OLD collection
  // (still searchable) and a background sync re-embeds them into the
  // NEW one to keep results stable. Other spaces are unaffected.
  app.put('/api/embedder', async (req, res) => {
    const cur = getCurrentSpace();
    if (!cur) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    const space = getCurrentSpaceName();
    if (!space) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
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
      setSpaceEmbedderProvider(cur, provider);
      const cfg = resolveSpaceEmbedder(cur) ?? { provider: 'onnx' as const };
      await indexer.bindSpace(space, cfg);
      // Schedule a full re-embed against the new collection in the
      // background — without this, search within the space would
      // partly hit the old collection (where existing rows live) and
      // partly miss new edits. The cross-collection search still works
      // either way, but a single coherent collection per space is
      // simpler to reason about. Errors logged, not fatal.
      syncIndex(indexer, space).catch((err) =>
        log.warn(`embedder: post-switch sync failed: ${errorMessage(err)}`),
      );
      res.json({ provider, hasKey: !!apiKey });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Cost estimate for switching the current space to a given provider.
  // Walks the space on disk and reports a rough token + USD estimate.
  // Tokens are estimated as bytes/4 — accurate for English, low for CJK.
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
    const costUsd = provider === 'openai' ? (tokens * 0.02) / 1_000_000 : 0;
    res.json({ provider, files, bytes, tokens, costUsd });
  });
}

/** Walk a space directory and report each indexable file's size.
 *  Skips `.stashbase/` (our sidecar dir) and load-bearing hidden dirs. */
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

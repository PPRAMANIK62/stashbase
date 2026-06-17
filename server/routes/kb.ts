/**
 * KB-wide routes. The MCP surface needs only two things the filesystem
 * can't give an agent — semantic search and index status — plus the
 * `kb_info` orientation card; those are `/api/kb/search`,
 * `/api/kb/index-status`, and `/api/kb/info`. `/api/kb/rules` is the
 * renderer's KB-level STASHBASE.md editor. Everything else (file CRUD,
 * per-space rules) is plain file I/O the agent / GUI does directly.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { errorMessage, logger } from '../log.ts';
import { getKbRoot, requireSpaceExistsByName } from '../space.ts';
import { indexer, getSnapshotWarning } from '../state.ts';
import { remapSearchHitsForDisplay } from '../search-display.ts';
import { getKbInfo, getKbRules, kbRulesVersion, setKbRules } from '../kb.ts';
import { sendError } from '../http.ts';
import { getApiKey } from '../app-config.ts';

const log = logger('routes/kb');

export interface KbSearchScope {
  space?: string;
  pathPrefix?: string;
}

export function normalizeKbSearchScope(spaceRaw: unknown, pathPrefixRaw: unknown): KbSearchScope {
  const space = typeof spaceRaw === 'string' && spaceRaw.trim() ? spaceRaw.trim() : undefined;
  const pathPrefix = typeof pathPrefixRaw === 'string' && pathPrefixRaw.trim()
    ? normalizeKbPathPrefix(pathPrefixRaw.trim())
    : undefined;
  if (space) requireSpaceExistsByName(space);
  if (pathPrefix) {
    const first = pathPrefix.split('/')[0];
    requireSpaceExistsByName(first);
  }
  return { space, pathPrefix };
}

export function requireKbStatusSpace(spaceRaw: unknown): string | undefined {
  const space = typeof spaceRaw === 'string' && spaceRaw.trim() ? spaceRaw.trim() : undefined;
  if (space) requireSpaceExistsByName(space);
  return space;
}

export function mount(app: express.Express): void {
  // Hybrid search over the whole KB (optional `space` / `path_prefix`
  // filter). Powers MCP's `search_kb`. Hidden `.md` files are remapped or
  // dropped (same rule as /api/search) so an external client never sees
  // an internal path.
  app.post('/api/kb/search', async (req, res) => {
    try {
      const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      const topK = Number.isFinite(req.body?.top_k) ? Number(req.body.top_k) : 8;
      const { space, pathPrefix } = normalizeKbSearchScope(req.body?.space, req.body?.path_prefix);
      if (!query) return res.status(400).json({ error: 'query required' });
      if (!getApiKey()) {
        return res.status(412).json({
          error: 'semantic search is disabled until you add an OpenAI API key',
          code: 'EMBEDDER_KEY_REQUIRED',
        });
      }
      const hits = remapSearchHitsForDisplay(
        await indexer.search(query, topK, space, pathPrefix),
        getKbRoot(),
      );
      res.json({ hits });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Index status for the whole KB (or one `space`). Powers the totals
  // MCP's `reindex` reports after a sweep.
  app.get('/api/kb/index-status', async (req, res) => {
    try {
      const space = requireKbStatusSpace(req.query.space);
      const status = await indexer.status(space);
      // Recently-indexed slice: intersect the indexed file set with
      // their on-disk mtime, return top N. Helps an agent answer "what
      // did I just embed?" without a state.db timestamp column.
      let recentlyIndexed: Array<{ path: string; mtimeMs: number }> = [];
      try {
        const indexed = await indexer.listFiles(space);
        const kbRoot = getKbRoot();
        const enriched: Array<{ path: string; mtimeMs: number }> = [];
        for (const kbRel of Object.keys(indexed)) {
          try {
            const st = fs.statSync(path.join(kbRoot, kbRel));
            enriched.push({ path: kbRel, mtimeMs: st.mtimeMs });
          } catch { /* file vanished — drop from list */ }
        }
        enriched.sort((a, b) => b.mtimeMs - a.mtimeMs);
        recentlyIndexed = enriched.slice(0, 10);
      } catch (err) {
        log.warn(`recently_indexed enrichment failed: ${errorMessage(err)}`);
      }
      res.json({
        ...status,
        snapshotWarning: space ? getSnapshotWarning(space) : null,
        recentlyIndexed,
      });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // KB info = kb_root + spaces + rules. Powers MCP's `kb_info` tool —
  // the agent's orientation card at the start of a session.
  app.get('/api/kb/info', (_req, res) => {
    try {
      res.json(getKbInfo());
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // KB-level STASHBASE.md content. Powers the renderer's "STASHBASE.md"
  // row in the Knowledge base section.
  app.get('/api/kb/rules', (_req, res) => {
    try {
      res.json({ content: getKbRules(), version: kbRulesVersion() ?? undefined });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.post('/api/kb/rules', (req, res) => {
    if (typeof req.body?.content !== 'string') {
      return res.status(400).json({ error: 'content (string) required' });
    }
    const content = req.body.content;
    const baseVersion = typeof req.body?.baseVersion === 'string' ? req.body.baseVersion : undefined;
    try {
      res.json({ ok: true, version: setKbRules(content, { baseVersion }) ?? undefined });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

function normalizeKbPathPrefix(value: string): string {
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.includes('\\')) {
    throw new Error('path_prefix must be kbRoot-relative POSIX path');
  }
  const norm = value.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
  if (!norm) throw new Error('path_prefix required');
  if (/[\x00-\x1f'"]/.test(norm)) throw new Error('path_prefix contains invalid characters');
  for (const seg of norm.split('/')) {
    if (!seg || seg === '.' || seg === '..') throw new Error('path_prefix contains an invalid segment');
  }
  const abs = path.join(getKbRoot(), norm);
  const rel = path.relative(getKbRoot(), abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('path_prefix escapes kb_root');
  }
  return norm;
}

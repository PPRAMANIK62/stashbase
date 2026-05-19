/**
 * Indexing-related routes: hybrid search, manual full sync, the
 * lightweight status poll the UI uses to grey out pending files, and
 * the skills-sync route that mirrors `skills/<name>/SKILL.md` into the
 * active CLI's per-project prompt dir.
 */
import express from 'express';
import { errorMessage, logger } from '../log.ts';
import { getCurrentSpace } from '../space.ts';
import { syncIndex } from '../sync.ts';
import { syncSkillsToCli } from '../skills.ts';
import { getInFlightPdfs } from '../pdf.ts';
import { getFsChangeCounter } from '../watcher.ts';
import { indexer } from '../state.ts';
import { sendError } from '../http.ts';

const log = logger('routes/indexing');

export function mount(app: express.Express): void {
  // Trigger a space sync manually — useful after external edits / file
  // moves. Returns the diff (added / removed / failed).
  app.post('/api/sync', async (_req, res) => {
    try {
      res.json(await syncIndex(indexer));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Hybrid (vector + BM25) search. Also powers the MCP server when the
  // web server is running, so the MCP doesn't have to spawn its own
  // daemon (saves ~600 MB of duplicate model load).
  app.post('/api/search', async (req, res) => {
    try {
      const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      const topK = Number.isFinite(req.body?.top_k) ? Number(req.body.top_k) : 8;
      if (!query) return res.status(400).json({ error: 'query required' });
      res.json({ hits: await indexer.search(query, topK) });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Lightweight status — full `pending` list (not a sample) so the
  // sidebar can grey out the right rows. `treeVersion` bumps on every
  // external fs event, covering writes from Claude Code / `touch` that
  // wouldn't move `pending` (non-indexable files, empty dirs). Also
  // surfaces in-flight PDF conversions for the conversion indicator.
  app.get('/api/index-status', async (_req, res) => {
    try {
      const root = getCurrentSpace();
      if (!root) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
      const status = await indexer.status(root);
      res.json({
        ...status,
        pendingConversions: getInFlightPdfs(),
        treeVersion: getFsChangeCounter(),
      });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Mirror `skills/<name>/SKILL.md` into the active CLI's per-project
  // prompt directory (Claude Code's `.claude/commands/` or Codex's
  // `.codex/prompts/`). The renderer fires this on terminal panel
  // open / CLI switch so the user can author commands once under
  // `skills/` and have them appear for whichever CLI they pick.
  app.post('/api/skills/sync', (req, res) => {
    const cur = getCurrentSpace();
    if (!cur) return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    const cli = req.body?.cli;
    if (cli !== 'claude' && cli !== 'codex') {
      return res.status(400).json({ error: 'cli must be "claude" or "codex"' });
    }
    try {
      res.json(syncSkillsToCli(cur, cli));
    } catch (err: unknown) {
      sendError(res, err);
    }
    // Mark log as used (currently silent on the happy path).
    void log;
  });
}

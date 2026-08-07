/** Shared Agent Contract history routes. Legacy Claude/Codex paths remain
 * mounted for existing clients; the built-in renderer uses this one surface.
 *
 * Every route accepts an optional `folder` query param — the explicit session
 * folder a chat tab is scoped to. It must be a registered library folder
 * (400 otherwise); when absent the window's current folder applies, exactly
 * as before. */
import express from 'express';
import { agentAdapter, resolveAgentSessionFolder } from '../agent-contract.ts';
import { getCurrentFolder, memberFolderRoots } from '../folder.ts';
import { sendError } from '../http.ts';

function historyFor(id: string) {
  const adapter = agentAdapter(id);
  if (!adapter) {
    const error = new Error('agent runtime not found') as Error & { status: number };
    error.status = 404;
    throw error;
  }
  return adapter.history;
}

/** Resolve the request's history scope: explicit member folder, else the
 * window's current folder. Throws a 400-carrying error for non-members. */
function historyFolderOf(req: express.Request): string | null {
  const resolved = resolveAgentSessionFolder(req.query.folder, memberFolderRoots());
  if (!resolved.ok) {
    const error = new Error(resolved.message) as Error & { status: number };
    error.status = 400;
    throw error;
  }
  return resolved.folder ?? getCurrentFolder();
}

export function mount(app: express.Express): void {
  app.get('/api/agents/:agent/sessions', async (req, res) => {
    try {
      res.json(await historyFor(req.params.agent).list(historyFolderOf(req)));
    } catch (err) {
      sendError(res, err);
    }
  });
  app.get('/api/agents/:agent/sessions/:id/messages', async (req, res) => {
    try {
      res.json(await historyFor(req.params.agent).messages(req.params.id, historyFolderOf(req)));
    } catch (err) {
      sendError(res, err);
    }
  });
  app.patch('/api/agents/:agent/sessions/:id', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'title required' });
    try {
      res.json(await historyFor(req.params.agent).rename(req.params.id, title, historyFolderOf(req)));
    } catch (err) {
      sendError(res, err);
    }
  });
  app.delete('/api/agents/:agent/sessions/:id', async (req, res) => {
    try {
      await historyFor(req.params.agent).remove(req.params.id, historyFolderOf(req));
      res.json({});
    } catch (err) {
      sendError(res, err);
    }
  });
}

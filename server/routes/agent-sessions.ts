/** Shared Agent Contract history routes. Legacy Claude/Codex paths remain
 * mounted for existing clients; the built-in renderer uses this one surface. */
import express from 'express';
import { agentAdapter } from '../agent-contract.ts';
import { getCurrentFolder } from '../folder.ts';
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

export function mount(app: express.Express): void {
  app.get('/api/agents/:agent/sessions', async (req, res) => {
    try {
      res.json(await historyFor(req.params.agent).list(getCurrentFolder()));
    } catch (err) {
      sendError(res, err);
    }
  });
  app.get('/api/agents/:agent/sessions/:id/messages', async (req, res) => {
    try {
      res.json(await historyFor(req.params.agent).messages(req.params.id, getCurrentFolder()));
    } catch (err) {
      sendError(res, err);
    }
  });
  app.patch('/api/agents/:agent/sessions/:id', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'title required' });
    try {
      res.json(await historyFor(req.params.agent).rename(req.params.id, title, getCurrentFolder()));
    } catch (err) {
      sendError(res, err);
    }
  });
  app.delete('/api/agents/:agent/sessions/:id', async (req, res) => {
    try {
      await historyFor(req.params.agent).remove(req.params.id, getCurrentFolder());
      res.json({});
    } catch (err) {
      sendError(res, err);
    }
  });
}

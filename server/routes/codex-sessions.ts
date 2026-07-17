/**
 * Codex thread-history routes for the chat panel's History dropdown.
 *
 * Backed by Codex app-server's structured thread APIs. Delete maps to the
 * native irreversible thread/delete operation so it has the same meaning as
 * Delete Chat for every built-in agent.
 */
import express from 'express';
import { getCurrentFolder } from '../folder.ts';
import { sendError } from '../http.ts';
import {
  deleteCodexSession,
  getCodexSessionMessages,
  listCodexSessions,
  renameCodexSession,
} from '../codex-agent.ts';
import { agentAdapter, type AgentHistoryActions } from '../agent-contract.ts';

export function mount(app: express.Express): void {
  app.get('/api/codex/sessions', async (_req, res) => {
    try {
      res.json(await codexHistory().list(getCurrentFolder()));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.get('/api/codex/sessions/:id/messages', async (req, res) => {
    try {
      res.json(await codexHistory().messages(req.params.id, getCurrentFolder()));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.patch('/api/codex/sessions/:id', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      res.status(400).json({ error: 'title required' });
      return;
    }
    try {
      res.json(await codexHistory().rename(req.params.id, title, getCurrentFolder()));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.delete('/api/codex/sessions/:id', async (req, res) => {
    try {
      await codexHistory().remove(req.params.id, getCurrentFolder());
      res.json({});
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

export function codexHistoryActions(): AgentHistoryActions {
  return {
    list: (folder) => listCodexSessions(folder),
    messages: (id, folder) => getCodexSessionMessages(id, folder),
    rename: (id, title, folder) => renameCodexSession(id, title, folder),
    remove: (id, folder) => deleteCodexSession(id, folder),
  };
}

function codexHistory(): AgentHistoryActions {
  return agentAdapter('codex')?.history ?? codexHistoryActions();
}

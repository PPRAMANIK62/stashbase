/** Shared Agent Contract history routes. Legacy Claude/Codex paths remain
 * mounted for existing clients; the built-in renderer uses this one surface.
 *
 * Every route accepts an optional explicit scope — `folder=<abs>` (a
 * registered library folder, 400 otherwise) or `scope=library` (the
 * reserved library scope: sessions whose cwd is the folder home). When
 * both are absent the window's current folder applies; without one, the
 * library scope. The LIST route additionally accepts `scope=all`: every
 * member folder plus the library bucket, merged newest-first, each row
 * tagged with its member `folder` (absent = library) so the client can
 * label and resume it in its own scope. */
import express from 'express';
import { agentAdapter, resolveAgentSessionScope } from '../agent-contract.ts';
import { getCurrentFolder, getFolderHome, memberFolderRoots } from '../folder.ts';
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

/** Resolve the request's history scope to the cwd sessions are stored
 * under: explicit member folder; `scope=library` → the folder home (the
 * reserved library cwd — library history never lives under a member
 * folder); absent → the window's current folder, else the library.
 * Throws a 400-carrying error for non-members / unknown scopes. */
function historyFolderOf(req: express.Request): string | null {
  const resolved = resolveAgentSessionScope(req.query.scope, req.query.folder, memberFolderRoots());
  if (!resolved.ok) {
    const error = new Error(resolved.message) as Error & { status: number };
    error.status = 400;
    throw error;
  }
  if (resolved.scope?.kind === 'folder') return resolved.scope.path;
  if (resolved.scope?.kind === 'library') return getFolderHome();
  return getCurrentFolder() ?? getFolderHome();
}

/** The `scope=all` listing: the library bucket plus every member folder,
 * merged newest-first. Member rows carry their `folder` so the client can
 * label them and route row actions (resume / rename / delete) through the
 * row's own scope; library rows stay untagged. One unreadable bucket must
 * not blank the rest of the history. */
export async function listAllSessions(
  history: { list: (cwd: string | null) => Promise<unknown[]> },
  home: string,
  memberRoots: readonly string[],
): Promise<unknown[]> {
  const buckets = [home, ...memberRoots.filter((root) => root !== home)];
  const lists = await Promise.all(buckets.map(async (root) => {
    try {
      const rows = await history.list(root) as Record<string, unknown>[];
      return root === home ? rows : rows.map((row) => ({ ...row, folder: root }));
    } catch {
      return [];
    }
  }));
  const modified = (row: unknown) => Number((row as Record<string, unknown>).lastModified) || 0;
  return lists.flat().sort((a, b) => modified(b) - modified(a));
}

export function mount(app: express.Express): void {
  app.get('/api/agents/:agent/sessions', async (req, res) => {
    try {
      if (req.query.scope === 'all') {
        if (req.query.folder) {
          return res.status(400).json({ error: 'scope=all cannot be combined with a folder' });
        }
        return res.json(await listAllSessions(
          historyFor(req.params.agent),
          getFolderHome(),
          memberFolderRoots(),
        ));
      }
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
  app.get('/api/agents/:agent/sessions/:id/replay', async (req, res) => {
    try {
      const history = historyFor(req.params.agent);
      if (!history.replay) return res.status(404).json({ error: 'replay metadata unavailable' });
      res.json(await history.replay(req.params.id, historyFolderOf(req)));
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

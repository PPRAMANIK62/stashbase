/** Application-level Workbench preferences. One durable value today: whether
 * eligible hidden dot-directories join folder listings. The server persists
 * and normalizes it; every window's listing applies the same state. */
import type express from 'express';
import {
  workspacePreferencesRequestSchema,
  workspacePreferencesSchema,
} from '../../shared/protocols/http/workspace-preferences.ts';
import { getWorkspacePreferences, setWorkspacePreferences } from '../app-config.ts';
import { sendError } from '../http.ts';
import { noteTreeChanged } from '../watcher.ts';

export function mount(app: express.Express): void {
  app.get('/api/workspace-preferences', (_req, res) => {
    res.json(workspacePreferencesSchema.parse(getWorkspacePreferences()));
  });

  app.put('/api/workspace-preferences', (req, res) => {
    // The body reaches durable configuration, so it is parsed rather than
    // forwarded: an unknown key would otherwise be written to config.json and
    // read back by every later merge.
    const request = workspacePreferencesRequestSchema.safeParse(req.body ?? {});
    if (!request.success) {
      res.status(400).json({ error: 'showHiddenFiles must be a boolean' });
      return;
    }
    try {
      const resolved = workspacePreferencesSchema.parse(setWorkspacePreferences(request.data));
      // The visible tree may have changed for every open window; the shared
      // tree-version signal makes each of them refetch `/api/files`.
      noteTreeChanged();
      res.json(resolved);
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

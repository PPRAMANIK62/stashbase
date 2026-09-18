/** Pending revision proposals, drained by the window that has the folder open.
 * `server/document-revisions.ts` owns the store and why the read consumes what
 * it returns. Membership is checked first: the folder must be one of the
 * caller's own, the same bar every other project read clears. */
import type express from 'express';
import {
  documentRevisionsRequestSchema,
  documentRevisionsResponseSchema,
} from '../../shared/protocols/http/document-revisions.ts';
import { drainPendingProposals } from '../document-revisions.ts';
import { filesystemPath } from '../filesystem-path.ts';
import { getCurrentFolder } from '../folder.ts';
import { sendError } from '../http.ts';
import { requireProjectStatusFolder, routeError } from '../project-file-access.ts';

export function mount(app: express.Express): void {
  app.get('/api/document-revisions', async (req, res) => {
    const request = documentRevisionsRequestSchema.safeParse(req.query ?? {});
    if (!request.success) {
      res.status(400).json({ error: 'folder must be an absolute path to one of your folders' });
      return;
    }
    try {
      const active = getCurrentFolder();
      if (!active) throw routeError('Open the folder in this window before collecting revisions.', 409, 'FOLDER_CHANGED');
      const folder = await requireProjectStatusFolder(request.data.folder);
      if (!filesystemPath.equal(active, folder) || !filesystemPath.equal(getCurrentFolder() ?? '', folder)) {
        throw routeError('The requested folder is no longer active in this window.', 409, 'FOLDER_CHANGED');
      }
      // Delivery is at most once. The proposals leave the store here, and a
      // reset socket or a closed window loses them rather than redelivering.
      // That is the price of never handing one review to two readers.
      const proposals = drainPendingProposals(folder);
      res.json(documentRevisionsResponseSchema.parse({ folder, proposals }));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

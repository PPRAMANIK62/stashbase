/** Active-folder file surface. This module owns note list/create/read/write
 * and reveal, then composes mutation, ordering, and asset subroutes. */
import express from 'express';
import {
  createTextExclusive,
  detectFormat,
  fileVersion,
  fileStatVersion,
  getCurrentFolderBasename,
  listFilesAndFoldersAsync,
  pathExists,
  readText,
  resolveExisting,
  sanitizeFilename,
} from '../files.ts';
import { detectViewerFormat, isNoteName } from '../format.ts';
import { exactMemberFolderRoot, getCurrentFolderLabel, runWithFolderRoot } from '../folder.ts';
import { filesystemPath } from '../filesystem-path.ts';
import { sendError, revealInOsFileManager } from '../http.ts';
import { noteTreeChanged } from '../watcher.ts';
import { saveFileContent, upsertSavedFile } from '../file-save.ts';
import { readGenericFilePreview } from '../generic-file-preview.ts';
import { mountFileAssetRoutes } from './file-assets.ts';
import { mountFileMutationRoutes } from './file-mutations.ts';
import { mountFileOrderRoutes } from './file-order.ts';

export { prepareFileOperation } from '../file-operation-guard.ts';
export { saveFileContent, validateEditableFileWrite } from '../file-save.ts';

export function fileHeadStatus(name: string): number {
  const format = detectViewerFormat(name);
  if (!format) return 415;
  if (!pathExists(name)) return 404;
  return 204;
}

/** Run a READ handler against an explicit `?folder=` member folder when the
 *  request carries one; otherwise against the window's own folder. Same
 *  membership rule as the `/api/files?folder=` listing above. */
async function runWithExplicitReadFolder(
  req: express.Request,
  res: express.Response,
  fn: () => void,
): Promise<void> {
  const rawFolder = typeof req.query.folder === 'string' ? req.query.folder.trim() : '';
  if (!rawFolder) return fn();
  const member = filesystemPath.isAbsolute(rawFolder) ? exactMemberFolderRoot(rawFolder) : null;
  if (!member) {
    res.status(400).json({ error: 'folder is not a registered library folder' });
    return;
  }
  await runWithFolderRoot(member, fn).catch((err: unknown) => sendError(res, err));
}

async function handleWriteFile(req: express.Request, res: express.Response): Promise<void> {
  const content = (req.body ?? {}).content;
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content (string) required' });
    return;
  }
  const name = (req.params as any)[0] as string;
  const baseVersion = typeof (req.body ?? {}).baseVersion === 'string'
    ? (req.body ?? {}).baseVersion
    : undefined;
  try {
    res.json(await saveFileContent(name, content, { baseVersion }));
  } catch (err: unknown) {
    sendError(res, err);
  }
}

export function mount(app: express.Express): void {
  // ----- list -----
  // Optional `?folder=` lists an explicit library-member folder instead of
  // the window's current one. Powers cross-folder chat tabs (`@` mentions and
  // attachment validation run against the session's bound folder). Membership
  // is validated — an arbitrary filesystem path is rejected.
  app.get('/api/files', async (req, res) => {
    try {
      const rawFolder = typeof req.query.folder === 'string' ? req.query.folder.trim() : '';
      if (rawFolder) {
        const member = filesystemPath.isAbsolute(rawFolder)
          ? exactMemberFolderRoot(rawFolder)
          : null;
        if (!member) {
          return res.status(400).json({ error: 'folder is not a registered library folder' });
        }
        const result = await runWithFolderRoot(member, async () => ({
          folder: getCurrentFolderLabel() ?? getCurrentFolderBasename(),
          files: await listFilesAndFoldersAsync(),
        }));
        res.json({
          folder: result.folder,
          files: result.files.files,
          folders: result.files.folders,
        });
        return;
      }
      const listing = await listFilesAndFoldersAsync();
      res.json({
        folder: getCurrentFolderLabel() ?? getCurrentFolderBasename(),
        files: listing.files,
        folders: listing.folders,
      });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // ----- create -----
  // Body: { name?, content?, dir? }.
  //  - `name` omitted → auto-pick first free `untitled-N.md` (race-safe via O_EXCL).
  //  - `dir`  optional → place the file inside that folder-relative folder
  //    (must already exist; create with POST /api/folders first).
  // New Note always creates Markdown even though existing JSON and .txt
  // sources are also content-editable in their format-specific viewers.
  app.post('/api/files', async (req, res) => {
    const requestedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const dir = typeof req.body?.dir === 'string' ? req.body.dir.trim() : '';
    const ext = '.md';
    const prefix = dir ? dir.replace(/\/+$/, '') + '/' : '';
    try {
      let name: string;
      if (requestedName) {
        // Honour an extension the caller already typed; otherwise
        // attach Markdown. Existing note extensions remain recognized so an
        // explicit .html request is not rewritten to .html.md.
        const hasExt = isNoteName(requestedName);
        const base = hasExt ? requestedName : requestedName + ext;
        // Silently scrub characters that break cross-platform sync —
        // user keeps the original title in the file's first heading.
        name = sanitizeFilename(prefix + base);
        if (!createTextExclusive(name, content)) {
          return res.status(409).json({ error: 'file exists' });
        }
      } else {
        const MAX_TRIES = 10_000;
        let i = 1;
        let claimed = '';
        for (; i <= MAX_TRIES; i++) {
          const candidate = `${prefix}untitled-${i}${ext}`;
          if (createTextExclusive(candidate, content)) {
            claimed = candidate;
            break;
          }
        }
        if (!claimed) throw new Error(`could not find a free untitled-N (tried ${MAX_TRIES})`);
        name = claimed;
      }
      const indexWarning = await upsertSavedFile(name, content);
      noteTreeChanged();
      res.json({ name, content, indexWarning, version: fileVersion(name) ?? undefined });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // HEAD and GET accept an optional `?folder=` (validated member folder) so
  // an out-of-folder tab — a search result viewed without switching the
  // window's folder — can read by explicit folder. Reads only: every write
  // route below stays bound to the window's own folder.
  app.head('/api/files/*', (req, res) => {
    const name = (req.params as any)[0] as string;
    void runWithExplicitReadFolder(req, res, () => {
      try {
        const status = fileHeadStatus(name);
        if (status === 204) {
          const version = fileStatVersion(name);
          if (version) res.setHeader('x-stashbase-file-version', version);
        }
        res.sendStatus(status);
      } catch (err: unknown) {
        sendError(res, err);
      }
    });
  });

  // Generic workspace entries are inspected only when selected. Keeping this
  // route separate from `/api/files/*` prevents a workbench-only capability
  // from becoming an editable, indexable, or Agent-readable document.
  app.get('/api/file-preview/*', (req, res) => {
    const name = (req.params as any)[0] as string;
    void runWithExplicitReadFolder(req, res, () => {
      try {
        res.json(readGenericFilePreview(name));
      } catch (err: unknown) {
        sendError(res, err);
      }
    });
  });

  // ----- read -----
  app.get('/api/files/*', (req, res) => {
    const name = (req.params as any)[0] as string;
    void runWithExplicitReadFolder(req, res, () => {
      try {
        // Refuse anything outside the recognized direct-text formats. Bundle assets
        // (the PNG / CSS / WOFF that live alongside an arxiv html in its
        // `_files/` folder) get saved to disk so the iframe can pull them
        // via `/asset/*`, but they're not viewable through this route —
        // a `readText` of binary bytes would otherwise hand the editor
        // garbled UTF-8 to render.
        const format = detectFormat(name);
        if (!format) return res.status(415).json({ error: 'unsupported format' });
        const content = readText(name);
        if (content == null) return res.status(404).json({ error: 'not found' });
        // Raw HTML in `content` (what the editor needs); the preview iframe
        // loads its prepared version via `/asset/*` — keeping injected ids +
        // bootstrap script out of the bytes that round-trip through the
        // editor (otherwise autosave would rewrite the file to include them).
        res.json({ name, format, content, version: fileVersion(name) ?? undefined });
      } catch (err: unknown) {
        sendError(res, err);
      }
    });
  });

  // ----- write -----
  // Overwrite a file's content and rebuild its index entry. `upsertFile`
  // deletes existing rows for this source before inserting the freshly
  // chunked + embedded set, so a save reflects edits cleanly.
  app.put('/api/files/*', async (req, res) => {
    await handleWriteFile(req, res);
  });

  // `navigator.sendBeacon()` always sends POST. The renderer uses it in
  // `beforeunload` for the last unsaved buffer, so accept POST on the
  // file-specific path as an unload-safe alias for PUT. Creation remains
  // `POST /api/files` above; this wildcard route does not match that
  // exact path.
  app.post('/api/files/*', async (req, res) => {
    await handleWriteFile(req, res);
  });

  mountFileMutationRoutes(app);

  // ----- reveal in OS -----
  // The renderer sends the folder-relative name and we resolve + shell
  // out here. Fire-and-forget spawn; we just confirm the file exists
  // before launching.
  app.post('/api/reveal/*', (req, res) => {
    const name = (req.params as any)[0] as string;
    try {
      const abs = resolveExisting(name);
      if (!abs) return res.status(404).json({ error: 'not found' });
      revealInOsFileManager(abs);
      res.json({});
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  mountFileOrderRoutes(app);
  mountFileAssetRoutes(app);
}

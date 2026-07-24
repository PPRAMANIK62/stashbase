/**
 * Library-wide routes. External agents talk in absolute source paths because
 * they may run in sandboxes that cannot read the user's local filesystem.
 * These routes are the host-side bridge for semantic search, index status,
 * orientation, library rules, and file CRUD.
 */
import express from 'express';
import fs from 'node:fs';
import { errorMessage, logger } from '../log.ts';
import { indexer } from '../state.ts';
import { sendError } from '../http.ts';
import {
  requireLibraryStatusFolder,
} from '../library-file-access.ts';
import { agentContextFile } from '../library-file-reader.ts';
import { createLibraryOperations, type LibraryOperations } from '../library-operations/index.ts';

export {
  normalizeLibraryFilePath,
  normalizeLibrarySearchScope,
  requireLibraryStatusFolder,
  type AgentContextFile,
  type LibrarySearchScope,
} from '../library-file-access.ts';
export { agentContextFile, readLibraryFile } from '../library-file-reader.ts';
export { listLibraryDirectory } from '../library-directory.ts';
export {
  deleteLibraryFile,
  editLibraryFile,
  moveLibraryFile,
  writeLibraryFile,
} from '../library-file-mutations.ts';

const log = logger('routes/library-files');


export function mount(app: express.Express, operations: LibraryOperations = createLibraryOperations()): void {
  // Hybrid search over the whole library (optional `folder` / `path_prefix`
  // filter). Powers MCP's `search_library`. Hidden `.md` files are remapped or
  // dropped (same rule as /api/search) so an external client never sees
  // an internal path.
  app.post('/api/library/search', async (req, res) => {
    try {
      const query = typeof req.body?.query === 'string' ? req.body.query : '';
      const topK = Number.isFinite(req.body?.top_k) ? Number(req.body.top_k) : 8;
      res.json(await operations.search({ query, topK, folder: req.body?.folder, pathPrefix: req.body?.path_prefix }));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Index status for the whole library (or one `folder`). Powers the totals
  // MCP's `reindex` reports after a sweep.
  app.get('/api/library/index-status', async (req, res) => {
    try {
      const folderRoot = requireLibraryStatusFolder(req.query.folder);
      const status = await indexer.status(folderRoot);
      // Recently-indexed slice: intersect the indexed file set with
      // their on-disk mtime, return top N. Helps an agent answer "what
      // did I just embed?" without a state.db timestamp column. Paths are
      // absolute (members live anywhere).
      let recentlyIndexed: Array<{ path: string; mtimeMs: number }> = [];
      try {
        const indexed = await indexer.listFiles(folderRoot);
        const enriched: Array<{ path: string; mtimeMs: number }> = [];
        for (const abs of Object.keys(indexed)) {
          try {
            const st = fs.statSync(abs);
            enriched.push({ path: abs, mtimeMs: st.mtimeMs });
          } catch { /* file vanished — drop from list */ }
        }
        enriched.sort((a, b) => b.mtimeMs - a.mtimeMs);
        recentlyIndexed = enriched.slice(0, 10);
      } catch (err) {
        log.warn(`recently_indexed enrichment failed: ${errorMessage(err)}`);
      }
      res.json({
        ...status,
        recentlyIndexed,
      });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Reconcile one folder or the whole library. Powers MCP `reindex` while
  // keeping membership resolution inside the app server instead of the stdio
  // MCP host.
  app.post('/api/library/reindex', async (req, res) => {
    try {
      const folder = req.body?.folder ?? req.query.folder;
      res.json(await operations.reindex({ folder: typeof folder === 'string' ? folder : undefined }));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Library info = folder_home + folders. Powers MCP's `library_info` tool — the agent's
  // orientation card at the start of a session.
  app.get('/api/library/info', async (_req, res) => {
    try {
      res.json(await operations.info());
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Resolve the best file path to hand to a built-in agent for a visible
  // source file. PDF/DOCX use app-data extracted text for reading. HTML/images
  // keep the original source as the read path; their extracted text layers
  // are indexing inputs, not source replacements.
  app.get('/api/library/agent-context-file', async (req, res) => {
    try {
      res.json(await agentContextFile(req.query.path));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.get('/api/library/directory', async (req, res) => {
    try {
      res.json(await operations.listDirectory(req.query.path));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.get('/api/library/file', async (req, res) => {
    try {
      res.json(await operations.read(req.query.path));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.put('/api/library/file', async (req, res) => {
    try {
      const filePath = req.body?.path;
      const content = req.body?.content;
      const baseVersion = typeof req.body?.baseVersion === 'string' ? req.body.baseVersion : undefined;
      res.json(await operations.write({ path: filePath, content, baseVersion }));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.post('/api/library/file/edit', async (req, res) => {
    try {
      const filePath = req.body?.path;
      const oldText = req.body?.old_text;
      const newText = req.body?.new_text;
      const baseVersion = typeof req.body?.baseVersion === 'string' ? req.body.baseVersion : undefined;
      res.json(await operations.edit({ path: filePath, oldText, newText, replaceAll: req.body?.replace_all === true, baseVersion }));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.patch('/api/library/file/move', async (req, res) => {
    try {
      res.json(await operations.move({ path: req.body?.path, newPath: req.body?.new_path, cascade: req.body?.cascade !== false }));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.delete('/api/library/file', async (req, res) => {
    try {
      res.json(await operations.delete(req.query.path));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

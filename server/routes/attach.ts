/**
 * Composer attachments — files a user drags or picks into the chat panel
 * as transient context. Unlike `/api/upload` (which imports into the
 * active space, where files are indexed + tree-visible + tracked by git),
 * these are written to a throwaway OS temp dir and referenced by absolute
 * path: the agent reads them via its Read tool, but they never land in
 * the user's knowledge base.
 */
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sanitizeFilename } from '../files.ts';
import { errorMessage, logger } from '../log.ts';

const log = logger('routes/attach');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024, files: 50 },
});

/** Root for transient attachment files, outside any space. */
function attachRoot(): string {
  return path.join(os.tmpdir(), 'stashbase-attachments');
}

export function mount(app: express.Express): void {
  app.post('/api/agent/attach', upload.array('files', 50), (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) { res.status(400).json({ error: 'no files' }); return; }
    // One throwaway dir per batch so same-named files never collide.
    const dir = path.join(attachRoot(), randomUUID());
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err: unknown) {
      res.status(500).json({ error: errorMessage(err) });
      return;
    }
    const out: { name: string; path?: string; error?: string }[] = [];
    for (const f of files) {
      const name = sanitizeFilename(f.originalname || 'file');
      try {
        const abs = path.join(dir, name);
        fs.writeFileSync(abs, f.buffer);
        out.push({ name, path: abs });
      } catch (err: unknown) {
        log.warn(`attach: write ${name} failed: ${errorMessage(err)}`);
        out.push({ name, error: errorMessage(err) });
      }
    }
    res.json({ files: out });
  });
}

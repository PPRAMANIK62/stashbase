import express from 'express';
import { readFileOrder, setFolderOrder } from '../file-order.ts';
import { getCurrentFolder } from '../folder.ts';
import { sendError } from '../http.ts';

export function mountFileOrderRoutes(app: express.Express): void {
  app.get('/api/file-order', (_req, res) => {
    if (!getCurrentFolder()) {
      return res.status(412).json({ error: 'no folder open', code: 'NO_FOLDER' });
    }
    try {
      res.json(readFileOrder());
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.put('/api/file-order', (req, res) => {
    if (!getCurrentFolder()) {
      return res.status(412).json({ error: 'no folder open', code: 'NO_FOLDER' });
    }
    const parentPath = typeof req.body?.parentPath === 'string' ? req.body.parentPath : null;
    const names = req.body?.names;
    if (parentPath == null) {
      return res.status(400).json({ error: 'parentPath required (string, "" for root)' });
    }
    if (!Array.isArray(names) || !names.every((name) => typeof name === 'string')) {
      return res.status(400).json({ error: 'names must be string[]' });
    }
    try {
      setFolderOrder(parentPath, names);
      res.json({});
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

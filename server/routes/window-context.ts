/** Native BrowserWindow lifecycle routes. Kept independent from folder/library
 * setup so closing a renderer can always retire its request identity quickly. */
import express from 'express';
import { retireWindow } from '../folder.ts';

export function mount(app: express.Express): void {
  app.delete('/api/window', (_req, res) => {
    retireWindow();
    res.json({ ok: true });
  });
}

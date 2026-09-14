/** Settings observes the same component owner that preparation waits on. */
import type express from 'express';
import { localComponentRetryRequestSchema, localComponentStatusSchema } from '../../shared/protocols/http/local-components.ts';
import { extractorComponent } from '../python-host.ts';
import { sendError } from '../http.ts';

export function mount(app: express.Express, component = extractorComponent): void {
  app.get('/api/local-components/extractor', async (_req, res) => {
    try { res.json(localComponentStatusSchema.parse(await component.status())); }
    catch (error) { sendError(res, error); }
  });
  app.post('/api/local-components/extractor/retry', async (req, res) => {
    if (!localComponentRetryRequestSchema.safeParse(req.body ?? {}).success) {
      res.status(400).json({ error: 'No component options are accepted.' });
      return;
    }
    try { res.status(202).json(localComponentStatusSchema.parse(await component.retry())); }
    catch (error) { sendError(res, error); }
  });
}

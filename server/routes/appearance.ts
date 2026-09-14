/** User-wide appearance settings. The server persists only bounded presets;
 * the renderer resolves system color scheme live through CSS. */
import type express from 'express';
import {
  getAppearancePreferences,
  setAppearancePreferences,
} from '../app-config.ts';
import { sendError } from '../http.ts';
import { appearancePreferencesRequestSchema } from '../../shared/protocols/http/appearance.ts';

export function mount(app: express.Express): void {
  app.get('/api/appearance', (_req, res) => {
    res.json(getAppearancePreferences());
  });

  app.put('/api/appearance', (req, res) => {
    const request = appearancePreferencesRequestSchema.safeParse(req.body);
    if (!request.success) {
      return res.status(400).json({ error: 'invalid appearance preferences' });
    }
    try {
      res.json(setAppearancePreferences(request.data));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

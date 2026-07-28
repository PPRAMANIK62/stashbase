/** User-wide appearance settings. The server persists only bounded presets;
 * the renderer resolves system color scheme live through CSS. */
import type express from 'express';
import {
  getAppearancePreferences,
  setAppearancePreferences,
  type AppearanceScale,
  type AppearanceTheme,
} from '../app-config.ts';
import { sendError } from '../http.ts';

function validTheme(value: unknown): value is AppearanceTheme {
  return value === 'system' || value === 'light' || value === 'dark';
}

function validScale(value: unknown): value is AppearanceScale {
  return value === 'small' || value === 'default' || value === 'large';
}

export function mount(app: express.Express): void {
  app.get('/api/appearance', (_req, res) => {
    res.json(getAppearancePreferences());
  });

  app.put('/api/appearance', (req, res) => {
    const body = req.body ?? {};
    if (body.theme !== undefined && !validTheme(body.theme)) {
      return res.status(400).json({ error: 'theme must be system, light, or dark' });
    }
    if (body.uiScale !== undefined && !validScale(body.uiScale)) {
      return res.status(400).json({ error: 'uiScale must be small, default, or large' });
    }
    if (body.readingTextSize !== undefined && !validScale(body.readingTextSize)) {
      return res.status(400).json({ error: 'readingTextSize must be small, default, or large' });
    }
    try {
      res.json(setAppearancePreferences(body));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

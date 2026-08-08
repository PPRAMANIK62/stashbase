/** User-wide onboarding preferences for feature explanation dialogs. */
import type express from 'express';
import {
  getOnboardingPreferences,
  setOnboardingPreferences,
} from '../app-config.ts';
import { sendError } from '../http.ts';

export function mount(app: express.Express): void {
  app.get('/api/onboarding', (_req, res) => {
    res.json(getOnboardingPreferences());
  });

  app.put('/api/onboarding', (req, res) => {
    const body = req.body ?? {};
    try {
      res.json(setOnboardingPreferences(body));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

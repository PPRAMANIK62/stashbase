/** User-wide onboarding preferences for feature explanation dialogs. */
import type express from 'express';
import {
  onboardingPreferencesRequestSchema,
  onboardingPreferencesSchema,
} from '../../shared/protocols/http/onboarding.ts';
import {
  getOnboardingPreferences,
  setOnboardingPreferences,
} from '../app-config.ts';
import { sendError } from '../http.ts';

export function mount(app: express.Express): void {
  app.get('/api/onboarding', (_req, res) => {
    res.json(onboardingPreferencesSchema.parse(getOnboardingPreferences()));
  });

  app.put('/api/onboarding', (req, res) => {
    // The body reaches durable configuration, so it is parsed rather than
    // spread: an unknown key would otherwise be written to config.json and
    // read back forever by every later merge.
    const request = onboardingPreferencesRequestSchema.safeParse(req.body ?? {});
    if (!request.success) {
      res.status(400).json({ error: 'unknown or invalid onboarding preference' });
      return;
    }
    try {
      res.json(onboardingPreferencesSchema.parse(setOnboardingPreferences(request.data)));
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

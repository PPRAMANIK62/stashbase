import type { OnboardingAnswers, OnboardingPort } from '@/features/settings/application/ports';
import { settingsRequest } from '@/features/settings/infrastructure/settings-request';
import { request } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  onboardingPreferencesRequestSchema,
  onboardingPreferencesSchema,
  type OnboardingPreferencesWire,
} from '@/protocols/http/onboarding';

function notices(signal: AbortSignal, unavailable: string) {
  return settingsRequest({
    invalidResponse: 'Onboarding preferences returned an invalid response.',
    path: '/api/onboarding',
    signal,
    unavailable,
  });
}

function toAnswers(wire: OnboardingPreferencesWire): OnboardingAnswers {
  return { searchSetupInvitationVersion: wire.searchSetupInvitationVersion ?? null };
}

export function createOnboardingAdapter(client: HttpClient): OnboardingPort {
  return {
    async answerSearchSetup(version, signal) {
      return toAnswers(
        await request(client, {
          ...notices(signal, 'That choice could not be saved.'),
          body: onboardingPreferencesRequestSchema.parse({ searchSetupInvitationVersion: version }),
          method: 'PUT',
          schema: onboardingPreferencesSchema,
        }),
      );
    },
    async load(signal) {
      return toAnswers(
        await request(client, {
          ...notices(signal, 'Onboarding preferences are unavailable.'),
          schema: onboardingPreferencesSchema,
        }),
      );
    },
  };
}

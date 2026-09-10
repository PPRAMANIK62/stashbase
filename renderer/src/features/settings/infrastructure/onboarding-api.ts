import {
  SettingsError,
  type OnboardingAnswers,
  type OnboardingPort,
} from '@/features/settings/application/ports';
import {
  request,
  requestOptions,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  onboardingPreferencesRequestSchema,
  onboardingPreferencesSchema,
  type OnboardingPreferencesWire,
} from '@/protocols/http/onboarding';

/** A refused notice is this renderer sending something the server does not
 *  own, not a lost capability. */
function invalidRequest(fallback: string) {
  return ({ response, serverMessage }: TransportFailure): SettingsError | null =>
    response.status === 400
      ? new SettingsError('invalid-request', serverMessage ?? fallback)
      : null;
}

function notices(signal: AbortSignal, fallback: string): TransportRequest<'invalid-request'> {
  return requestOptions({
    error: SettingsError,
    failure: invalidRequest(fallback),
    messages: {
      'invalid-response': 'Onboarding preferences returned an invalid response.',
      unavailable: fallback,
    },
    path: '/api/onboarding',
    serverMessage: true,
    signal,
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

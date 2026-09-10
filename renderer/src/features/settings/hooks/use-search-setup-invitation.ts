import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  SEARCH_SETUP_INVITATION_VERSION,
  type OnboardingAnswers,
  type OnboardingPort,
} from '@/features/settings/application/ports';
import { onboardingQuery, settingsQueryKeys } from '@/features/settings/application/queries';
import { searchSetupInvitation } from '@/features/settings/domain/search-setup-invitation';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

export interface SearchSetupInvitationInput {
  /** Whether an embedding source is configured, or null while the active
   *  folder's readiness has not answered. The caller reads it from that
   *  readiness; this feature never reaches for it. */
  readonly configured: boolean | null;
  /** True once a folder is active in this window. */
  readonly folderActive: boolean;
}

export interface SearchSetupInvitationView {
  /** True only while the invitation should be on screen. */
  readonly open: boolean;
  /** Record the answer. Both the accept and the decline path call it, because
   *  a reader who was shown the invitation has answered it either way. */
  answer(): void;
}

/**
 * The one-time invitation to set up search by meaning.
 *
 * The answer is durable and server-owned, so a decline survives a relaunch and
 * every later folder. Closing is local state rather than a read of that write:
 * the reader has answered the moment they click, and making them watch a round
 * trip would be the wrong emphasis. A failed write therefore leaves the stored
 * answer alone and the invitation returns on a later launch, which is the safe
 * direction to fail.
 */
export function useSearchSetupInvitation(
  port: OnboardingPort,
  input: SearchSetupInvitationInput,
): SearchSetupInvitationView {
  const client = useQueryClient();
  const signalFor = useRequestSignals<'answer'>();
  const answers = useQuery(onboardingQuery(port));

  const record = useMutation({
    mutationFn: (version: number) => port.answerSearchSetup(version, signalFor('answer')),
    onSuccess: (next: OnboardingAnswers) => client.setQueryData(settingsQueryKeys.onboarding, next),
  });

  const invitation = searchSetupInvitation({
    answeredVersion: answers.data?.searchSetupInvitationVersion ?? null,
    configured: input.configured,
    currentVersion: SEARCH_SETUP_INVITATION_VERSION,
    folderActive: input.folderActive,
    loaded: answers.isSuccess,
  });

  const [answeredHere, setAnsweredHere] = useState(false);
  const version = invitation.kind === 'offer' ? invitation.version : null;

  const answer = useCallback(() => {
    if (version === null || answeredHere) return;
    setAnsweredHere(true);
    record.mutate(version);
  }, [answeredHere, record, version]);

  return { answer, open: invitation.kind === 'offer' && !answeredHere };
}

/**
 * The StashBase account: who is signed in, and the two commands that change
 * it.
 *
 * A browser sign-in is tracked by its flow id and polled until the server
 * reports the flow finished. Either way the account changes, everything that
 * depends on it is re-read: OpenQuill's readiness and credits.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { settingsFailure } from '@/features/settings/application/failure-messages';
import type { AccountPort } from '@/features/settings/application/ports';
import { accountQuery, settingsQueryKeys } from '@/features/settings/application/queries';
import type { HostedAccount } from '@/features/settings/domain/account';
import {
  anyBusy,
  firstCommandFailure,
  useSettingsCommand,
} from '@/features/settings/hooks/use-settings-command';
import type { FailureView } from '@/shared/domain/feature-error';

const SIGN_IN_POLL_MS = 1_500;

/** The keys a changed account invalidates, in the order a reader would notice
 *  them. The account itself is written from the command's answer. */
const DEPENDENT_KEYS = [settingsQueryKeys.agentCatalog, settingsQueryKeys.agentAllowance] as const;

export interface AccountViewModel {
  /** Null until the first read lands, or while it cannot. */
  readonly account: HostedAccount | null;
  /** Any account command is open, including the browser round trip. */
  readonly busy: boolean;
  readonly failure: FailureView | null;
  readonly loading: boolean;
  /** The browser round trip is open: started, and not yet reported finished. */
  readonly signInPending: boolean;
  /** A browser flow is open and its local wait can be stopped. */
  readonly canStopWaiting: boolean;
  /** Stops local polling; it does not revoke authorization in the browser. */
  stopWaiting(): void;
  /** Starts the flow and hands the URL to the browser. */
  signIn(): void;
  signOut(): void;
}

export function useAccount(
  port: AccountPort,
  openExternal: (href: string) => void,
): AccountViewModel {
  const queryClient = useQueryClient();
  const account = useQuery(accountQuery(port));
  const [signInFlow, setSignInFlow] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<FailureView | null>(null);

  const flow = useQuery({
    enabled: signInFlow !== null,
    queryFn: ({ signal }) => port.signInStatus(signInFlow ?? '', signal),
    queryKey: [...settingsQueryKeys.account, 'sign-in', signInFlow] as const,
    refetchInterval: (query) => (query.state.data?.state === 'pending' ? SIGN_IN_POLL_MS : false),
    retry: false,
  });

  const invalidateDependents = useCallback(() => {
    for (const queryKey of DEPENDENT_KEYS) void queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  useEffect(() => {
    if (signInFlow && flow.isError) {
      setSignInFlow(null);
      setSignInError(settingsFailure(flow.error));
      return;
    }
    if (!signInFlow || !flow.data || flow.data.state === 'pending') return;
    setSignInFlow(null);
    if (flow.data.state === 'error') {
      setSignInError({ message: flow.data.error, tone: 'input' });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: settingsQueryKeys.account });
    invalidateDependents();
  }, [flow.data, flow.error, flow.isError, invalidateDependents, queryClient, signInFlow]);

  const stopWaiting = () => {
    if (!signInFlow) return;
    void queryClient.cancelQueries({
      queryKey: [...settingsQueryKeys.account, 'sign-in', signInFlow],
      exact: true,
    });
    setSignInFlow(null);
    setSignInError(null);
  };

  const startSignIn = useSettingsCommand(
    'startSignIn',
    (_input: void, signal) => port.startSignIn(signal),
    {
      onStart: () => setSignInError(null),
      onDone: (started) => {
        setSignInFlow(started.flowId);
        openExternal(started.url);
      },
    },
  );
  const signOut = useSettingsCommand('signOut', (_input: void, signal) => port.signOut(signal), {
    onDone: (next) => {
      queryClient.setQueryData(settingsQueryKeys.account, next);
      invalidateDependents();
    },
  });

  // One pending flag spans the whole browser round trip: the start call and
  // the poll that follows it are a single wait as far as the reader is
  // concerned, and a button must not flicker back between them.
  const signInPending = startSignIn.busy || signInFlow !== null;

  return {
    account: account.data ?? null,
    busy: signInPending || anyBusy(signOut),
    failure: signInError ?? firstCommandFailure(startSignIn, signOut),
    loading: account.isPending,
    signIn: () => startSignIn.run(),
    signInPending,
    canStopWaiting: signInFlow !== null,
    stopWaiting,
    signOut: () => signOut.run(),
  };
}

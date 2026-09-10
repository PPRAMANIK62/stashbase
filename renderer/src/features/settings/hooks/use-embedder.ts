/**
 * Reads and changes the search-by-meaning source.
 *
 * Every command gets its own abort lane, so removing a key cannot cancel an
 * account refresh that is already running, and leaving the panel cancels them
 * all. A browser sign-in is tracked by its flow id and polled until the
 * server reports the flow finished.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type { EmbedderProvider, EmbedderState } from '@/features/settings/domain/embedder';
import {
  anyBusy,
  firstCommandFailure,
  useSettingsCommand,
} from '@/features/settings/hooks/use-settings-command';
import type { FailureView } from '@/shared/domain/feature-error';

const embedderQueryKey = ['settings', 'embedder'] as const;

const SIGN_IN_POLL_MS = 1_500;

function embedderQuery(port: EmbedderPort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.load(signal),
    queryKey: embedderQueryKey,
    retry: false,
  } as const;
}

/** What the search-by-meaning panel renders and can do. */
export interface EmbedderViewModel {
  /** Any account-side command is open, including the browser round trip. */
  readonly accountBusy: boolean;
  readonly accountFailure: FailureView | null;
  readonly keyBusy: boolean;
  readonly keyFailure: FailureView | null;
  /** Saved, but StashBase could not verify the key yet. */
  readonly keyWarning: string | null;
  readonly loading: boolean;
  readonly savingKey: boolean;
  /** A source switch is open, so the radio group holds still until it lands. */
  readonly selecting: boolean;
  readonly signInPending: boolean;
  readonly state: EmbedderState | null;
  refreshAccount(): void;
  reload(): void;
  removeKey(): void;
  saveKey(input: { key: string; provider: EmbedderProvider }, onSaved: () => void): void;
  selectProvider(provider: EmbedderProvider): void;
  /** Starts the flow and hands the URL to the browser the panel opened with. */
  signIn(): void;
  signOut(): void;
  useAccount(): void;
}

export function useEmbedder(
  port: EmbedderPort,
  openExternal: (href: string) => void,
): EmbedderViewModel {
  const queryClient = useQueryClient();
  const state = useQuery(embedderQuery(port));
  const [signInFlow, setSignInFlow] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  const flow = useQuery({
    enabled: signInFlow !== null,
    queryFn: ({ signal }) => port.signInStatus(signInFlow ?? '', signal),
    queryKey: [...embedderQueryKey, 'sign-in', signInFlow] as const,
    refetchInterval: (query) => (query.state.data?.state === 'pending' ? SIGN_IN_POLL_MS : false),
    retry: false,
  });

  useEffect(() => {
    if (!signInFlow || !flow.data || flow.data.state === 'pending') return;
    setSignInFlow(null);
    if (flow.data.state === 'error') setSignInError(flow.data.error);
    else void queryClient.invalidateQueries({ queryKey: embedderQueryKey });
  }, [flow.data, queryClient, signInFlow]);

  const apply = (next: EmbedderState) => {
    queryClient.setQueryData(embedderQueryKey, next);
  };
  const invalidate = () => queryClient.invalidateQueries({ queryKey: embedderQueryKey });

  const reload = { onDone: () => void invalidate() };

  const saveKey = useSettingsCommand(
    'saveKey',
    ({ key, provider }: { key: string; provider: EmbedderProvider }, signal) =>
      port.saveKey(provider, key, signal),
    reload,
  );
  const removeKey = useSettingsCommand(
    'removeKey',
    (_input: void, signal) => port.removeKey(signal),
    {
      onDone: apply,
    },
  );
  const selectProvider = useSettingsCommand(
    'selectProvider',
    (provider: EmbedderProvider, signal) => port.selectProvider(provider, signal),
    { onDone: apply },
  );
  const useAccount = useSettingsCommand(
    'useAccount',
    (_input: void, signal) => port.useAccount(signal),
    reload,
  );
  const signOut = useSettingsCommand(
    'signOut',
    (_input: void, signal) => port.signOut(signal),
    reload,
  );
  const refreshAccount = useSettingsCommand(
    'refreshAccount',
    (_input: void, signal) => port.refreshAccount(signal),
    reload,
  );
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

  // One pending flag spans the whole browser round trip: the start call and
  // the poll that follows it are a single wait as far as the reader is
  // concerned, and the button must not flicker back between them.
  const signInPending = startSignIn.busy || signInFlow !== null;

  return {
    accountBusy: signInPending || anyBusy(signOut, useAccount, refreshAccount),
    accountFailure:
      signInError === null
        ? firstCommandFailure(startSignIn, signOut, useAccount, refreshAccount)
        : { message: signInError, tone: 'input' },
    keyBusy: anyBusy(saveKey, removeKey, selectProvider),
    keyFailure: firstCommandFailure(saveKey, removeKey, selectProvider),
    keyWarning: saveKey.result?.warning ?? null,
    loading: state.isPending,
    refreshAccount: () => refreshAccount.run(),
    reload: () => void state.refetch(),
    removeKey: () => removeKey.run(),
    saveKey: (input, onSaved) => saveKey.run(input, onSaved),
    savingKey: saveKey.busy,
    selectProvider: (provider) => selectProvider.run(provider),
    selecting: anyBusy(useAccount, selectProvider),
    signIn: () => startSignIn.run(),
    signInPending,
    signOut: () => signOut.run(),
    state: state.data ?? null,
    useAccount: () => useAccount.run(),
  };
}

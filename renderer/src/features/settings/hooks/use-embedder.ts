import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type {
  EmbedderPort,
  EmbedderProvider,
  EmbedderState,
} from '@/features/settings/application/embedder-port';

export const embedderQueryKey = ['settings', 'embedder'] as const;

const SIGN_IN_POLL_MS = 1_500;

export function embedderQuery(port: EmbedderPort) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) => port.load(signal),
    queryKey: embedderQueryKey,
    retry: false,
  } as const;
}

/** Reads and changes the AI Index source. A browser sign-in is tracked by
 *  its flow id and polled until the server reports completion. */
export function useEmbedder(port: EmbedderPort, enabled: boolean) {
  const queryClient = useQueryClient();
  const state = useQuery({ ...embedderQuery(port), enabled });
  const [signInFlow, setSignInFlow] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const signalRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      signalRef.current?.abort();
    },
    [],
  );

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
    if (flow.data.state === 'error') setSignInError(flow.data.error ?? 'Sign-in failed.');
    else void queryClient.invalidateQueries({ queryKey: embedderQueryKey });
  }, [flow.data, queryClient, signInFlow]);

  const apply = (next: EmbedderState) => queryClient.setQueryData(embedderQueryKey, next);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: embedderQueryKey });
  const fresh = () => {
    signalRef.current?.abort();
    signalRef.current = new AbortController();
    return signalRef.current.signal;
  };

  const saveKey = useMutation({
    mutationFn: ({ key, provider }: { key: string; provider: EmbedderProvider }) =>
      port.saveKey(provider, key, fresh()),
    onSuccess: () => void invalidate(),
  });
  const removeKey = useMutation({
    mutationFn: () => port.removeKey(fresh()),
    onSuccess: apply,
  });
  const selectProvider = useMutation({
    mutationFn: (provider: EmbedderProvider) => port.selectProvider(provider, fresh()),
    onSuccess: apply,
  });
  const useAccount = useMutation({
    mutationFn: () => port.useAccount(fresh()),
    onSuccess: () => void invalidate(),
  });
  const signOut = useMutation({
    mutationFn: () => port.signOut(fresh()),
    onSuccess: () => void invalidate(),
  });
  const refreshAccount = useMutation({
    mutationFn: () => port.refreshAccount(fresh()),
    onSuccess: () => void invalidate(),
  });
  const startSignIn = useMutation({
    mutationFn: () => port.startSignIn(fresh()),
    onMutate: () => setSignInError(null),
    onSuccess: (started) => setSignInFlow(started.flowId),
  });

  return {
    refreshAccount,
    removeKey,
    saveKey,
    selectProvider,
    signInError,
    signInPending: signInFlow !== null,
    signOut,
    startSignIn,
    state,
    useAccount,
  };
}

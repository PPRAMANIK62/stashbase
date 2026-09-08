import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AGENT_LABELS, AGENT_ORDER } from '@/features/agent/application/catalog';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import type { AgentId, AgentScope } from '@/features/agent/domain/session';

const HISTORY_QUERY_ROOT = ['agent', 'history'] as const;

function scopeKey(scope: AgentScope): string {
  return scope.kind === 'library' ? 'library' : `folder:${scope.path}`;
}

function historyQueryKey(agent: AgentId, scope: AgentScope) {
  return [...HISTORY_QUERY_ROOT, agent, scopeKey(scope)] as const;
}

export function useConversationHistory(runtime: AgentWorkspaceRuntime, scope: AgentScope) {
  const queryClient = useQueryClient();
  const mutationController = useRef<AbortController | null>(null);
  const [mutationFailure, setMutationFailure] = useState<string | null>(null);
  const queries = useQueries({
    queries: AGENT_ORDER.map((agent) => ({
      queryKey: historyQueryKey(agent, scope),
      queryFn: ({ signal }: { signal: AbortSignal }) => runtime.listHistory(agent, scope, signal),
      retry: false,
      staleTime: 5_000,
    })),
  });

  useEffect(() => () => mutationController.current?.abort(), []);

  const history = useMemo(() => queries.flatMap((query) => query.data ?? []), [queries]);
  const failedAgents = AGENT_ORDER.filter((_, index) => queries[index]?.isError);
  const historyFailure =
    failedAgents.length > 0
      ? `Chats unavailable for ${failedAgents.map((agent) => AGENT_LABELS[agent]).join(', ')}.`
      : null;

  const rename = useMutation({
    mutationFn: async ({ entry, title }: { entry: AgentHistoryEntry; title: string }) => {
      mutationController.current?.abort();
      const controller = new AbortController();
      mutationController.current = controller;
      return runtime.renameHistory(entry, title, controller.signal);
    },
    onMutate: () => setMutationFailure(null),
    onError: () => setMutationFailure('That conversation could not be renamed.'),
    onSuccess: (updated) => {
      queryClient.setQueryData<AgentHistoryEntry[]>(
        historyQueryKey(updated.agent, updated.scope),
        (entries = []) => entries.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    },
  });
  const remove = useMutation({
    mutationFn: async (entry: AgentHistoryEntry) => {
      mutationController.current?.abort();
      const controller = new AbortController();
      mutationController.current = controller;
      await runtime.removeHistory(entry, controller.signal);
      return entry;
    },
    onMutate: () => setMutationFailure(null),
    onError: () => setMutationFailure('That conversation could not be deleted.'),
    onSuccess: (removed) => {
      queryClient.setQueryData<AgentHistoryEntry[]>(
        historyQueryKey(removed.agent, removed.scope),
        (entries = []) => entries.filter((entry) => entry.id !== removed.id),
      );
    },
  });

  return {
    clearMutationFailure: () => setMutationFailure(null),
    history,
    historyFailure,
    historyLoading: queries.some((query) => query.isLoading) && history.length === 0,
    mutationFailure,
    mutationPending: rename.isPending || remove.isPending,
    remove: async (entry: AgentHistoryEntry) => {
      try {
        await remove.mutateAsync(entry);
        return true;
      } catch {
        return false;
      }
    },
    rename: async (entry: AgentHistoryEntry, title: string) => {
      try {
        await rename.mutateAsync({ entry, title });
        return true;
      } catch {
        return false;
      }
    },
    retry: () => Promise.all(queries.map((query) => query.refetch())),
  };
}

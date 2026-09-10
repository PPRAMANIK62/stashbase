import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  agentFailure,
  failureKind,
  type AgentContextErrorKind,
} from '@/features/agent/application/failure-messages';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { agentLabel, AGENT_ORDER } from '@/features/agent/domain/agent-catalog';
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import type { AgentId, AgentScope } from '@/features/agent/domain/session';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

const HISTORY_QUERY_ROOT = ['agent', 'history'] as const;

/** What a rename or a removal did. A bare `false` could not tell a caller
 *  whether the service refused the change or nothing was ever asked of it,
 *  so a refusal carries the kind behind it and the caller decides how to
 *  say so. */
export type AgentHistoryMutation =
  | { kind: 'done' }
  | { kind: 'refused'; reason: AgentContextErrorKind };

function scopeKey(scope: AgentScope): string {
  return scope.kind === 'library' ? 'library' : `folder:${scope.path}`;
}

function historyQueryKey(agent: AgentId, scope: AgentScope) {
  return [...HISTORY_QUERY_ROOT, agent, scopeKey(scope)] as const;
}

export function useConversationHistory(runtime: AgentWorkspaceRuntime, scope: AgentScope) {
  const queryClient = useQueryClient();
  const signalFor = useRequestSignals<'remove' | 'rename'>();
  const [mutationFailure, setMutationFailure] = useState<string | null>(null);
  const queries = useQueries({
    queries: AGENT_ORDER.map((agent) => ({
      queryKey: historyQueryKey(agent, scope),
      queryFn: ({ signal }: { signal: AbortSignal }) => runtime.listHistory(agent, scope, signal),
      retry: false,
      staleTime: 5_000,
    })),
  });

  const history = useMemo(() => queries.flatMap((query) => query.data ?? []), [queries]);
  const failedAgents = AGENT_ORDER.filter((_, index) => queries[index]?.isError);
  const historyFailure =
    failedAgents.length > 0
      ? `Chats unavailable for ${failedAgents.map(agentLabel).join(', ')}.`
      : null;

  const rename = useMutation({
    mutationFn: ({ entry, title }: { entry: AgentHistoryEntry; title: string }) =>
      runtime.renameHistory(entry, title, signalFor('rename')),
    onMutate: () => setMutationFailure(null),
    onError: (error) => setMutationFailure(agentFailure(error).message),
    onSuccess: (updated) => {
      queryClient.setQueryData<AgentHistoryEntry[]>(
        historyQueryKey(updated.agent, updated.scope),
        (entries = []) => entries.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    },
  });
  const remove = useMutation({
    mutationFn: async (entry: AgentHistoryEntry) => {
      await runtime.removeHistory(entry, signalFor('remove'));
      return entry;
    },
    onMutate: () => setMutationFailure(null),
    onError: (error) => setMutationFailure(agentFailure(error).message),
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
    remove: async (entry: AgentHistoryEntry): Promise<AgentHistoryMutation> => {
      try {
        await remove.mutateAsync(entry);
        return { kind: 'done' };
      } catch (error) {
        return { kind: 'refused', reason: failureKind(error) };
      }
    },
    rename: async (entry: AgentHistoryEntry, title: string): Promise<AgentHistoryMutation> => {
      try {
        await rename.mutateAsync({ entry, title });
        return { kind: 'done' };
      } catch (error) {
        return { kind: 'refused', reason: failureKind(error) };
      }
    },
    retry: () => Promise.all(queries.map((query) => query.refetch())),
  };
}

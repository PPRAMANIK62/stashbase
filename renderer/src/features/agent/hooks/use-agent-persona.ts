import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { agentFailure } from '@/features/agent/application/failure-messages';
import type {
  AgentPersona,
  AgentPersonaChange,
  AgentPersonaChoice,
  AgentPersonaPort,
} from '@/features/agent/application/ports';
import { agentScopeKey } from '@/features/agent/domain/session';
import type { AgentScope } from '@/features/agent/domain/session-state';
import type { FailureView } from '@/shared/domain/feature-error';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

export interface AgentPersonaPicker {
  readonly selected: AgentPersonaChoice | null;
  /** The reader's own prompt, empty until one is written. */
  readonly custom: string;
  readonly failure: FailureView | null;
  readonly loading: boolean;
  readonly saving: boolean;
  /** Runs a packaged persona, the stored custom prompt, or none. */
  choose(choice: AgentPersonaChoice | null): void;
  /** Stores the reader's own prompt and runs it. Answers whether it stored. */
  saveCustom(text: string): Promise<boolean>;
  dismissFailure(): void;
}

function queryKey(scope: AgentScope | null) {
  return ['agent-persona', scope ? agentScopeKey(scope) : null] as const;
}

function resolved(persona: AgentPersona): string {
  return persona.selected === 'custom' ? `custom:${persona.custom}` : String(persona.selected);
}

/**
 * The persona one scope's Chats run under, as the picker reads and changes it.
 *
 * A session reads its persona when it starts, so a change that alters what
 * runs calls `onApplied`, captured when the change was asked for: the Chat the
 * reader chose it in restarts on its own conversation and the persona applies
 * from its next message. The scope's wire spelling is the query key, and a
 * save lands in the scope it was asked for even if the reader has moved on.
 */
export function useAgentPersona(
  port: AgentPersonaPort,
  scope: AgentScope | null,
  onApplied: () => void,
): AgentPersonaPicker {
  const client = useQueryClient();
  const signalFor = useRequestSignals<'save'>();

  const stored = useQuery({
    enabled: scope !== null,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      scope ? port.load(scope, signal) : Promise.reject(new Error('no scope')),
    queryKey: queryKey(scope),
    retry: false,
  });

  const write = useMutation({
    mutationFn: ({
      change,
      target,
    }: {
      change: AgentPersonaChange;
      target: AgentScope;
      applied(): void;
    }) => port.save(target, change, signalFor('save')),
    onSuccess: (next, { applied, target }) => {
      const previous = client.getQueryData<AgentPersona>(queryKey(target));
      client.setQueryData(queryKey(target), next);
      if (!previous || resolved(previous) !== resolved(next)) applied();
    },
  });

  const { isPending: saving, mutate, mutateAsync, reset } = write;
  const current = stored.data;

  const choose = useCallback(
    (choice: AgentPersonaChoice | null) => {
      if (saving || scope === null || current?.selected === choice) return;
      mutate({ applied: onApplied, change: { selected: choice }, target: scope });
    },
    [current?.selected, mutate, onApplied, saving, scope],
  );

  const saveCustom = useCallback(
    async (text: string) => {
      if (saving || scope === null) return false;
      try {
        await mutateAsync({
          applied: onApplied,
          change: { custom: text, selected: 'custom' },
          target: scope,
        });
        return true;
      } catch {
        return false;
      }
    },
    [mutateAsync, onApplied, saving, scope],
  );

  return {
    custom: current?.custom ?? '',
    dismissFailure: reset,
    failure: write.error ? agentFailure(write.error) : null,
    loading: stored.isPending && scope !== null,
    saveCustom,
    saving,
    selected: current?.selected ?? null,
    choose,
  };
}

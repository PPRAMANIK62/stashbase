import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import type { AgentInstructionsPort } from '@/features/agent/application/ports';
import type { AgentScope } from '@/features/agent/domain/session-state';
import { agentScopeKey } from '@/features/agent/domain/session';
import { agentFailure } from '@/features/agent/application/failure-messages';
import type { FailureView } from '@/shared/domain/feature-error';

export interface AgentInstructionsEditor {
  /** True while the standing text is the reader's own rather than the
   *  packaged default. Drives the presence indicator. */
  readonly customized: boolean;
  readonly draft: string;
  readonly failure: FailureView | null;
  /** True once the draft differs from what is stored. */
  readonly dirty: boolean;
  readonly loading: boolean;
  readonly saving: boolean;
  /** Drop the draft back to the packaged default without saving. */
  reset(): void;
  save(): void;
  setDraft(next: string): void;
}

/**
 * The standing instructions for one scope, as the editor reads and changes
 * them.
 *
 * The scope's wire spelling is both the query key and the effect identity, so
 * switching Chats re-reads exactly once and a save can never land in the scope
 * the reader has just left.
 *
 * The draft is local until saved. Saving empty restores the packaged default,
 * which is the only way back once a scope has been customized.
 */
export function useAgentInstructions(
  port: AgentInstructionsPort,
  scope: AgentScope | null,
): AgentInstructionsEditor {
  const client = useQueryClient();
  const key = scope ? agentScopeKey(scope) : null;

  const stored = useQuery({
    enabled: scope !== null,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      scope ? port.load(scope, signal) : Promise.reject(new Error('no scope')),
    queryKey: ['agent-instructions', key] as const,
    retry: false,
  });

  const [draft, setDraft] = useState<string | null>(null);
  // A scope change abandons the draft: it belonged to the scope the reader
  // left, and carrying it forward would offer to save it into the new one.
  useEffect(() => setDraft(null), [key]);

  const write = useMutation({
    mutationFn: ({ scope: target, text }: { scope: AgentScope; text: string }) =>
      port.save(target, text, new AbortController().signal),
    onSuccess: (next) => {
      client.setQueryData(['agent-instructions', key], next);
      setDraft(null);
    },
  });

  const text = stored.data?.text ?? '';
  const current = draft ?? text;

  const { isPending: saving, mutate } = write;
  const save = useCallback(() => {
    if (saving || scope === null) return;
    mutate({ scope, text: current });
  }, [current, mutate, saving, scope]);

  return {
    customized: stored.data?.customized ?? false,
    dirty: draft !== null && draft !== text,
    draft: current,
    failure: write.error ? agentFailure(write.error) : null,
    loading: stored.isPending && scope !== null,
    reset: () => setDraft(''),
    save,
    saving,
    setDraft,
  };
}

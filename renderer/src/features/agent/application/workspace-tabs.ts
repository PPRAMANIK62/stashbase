import type { StoreApi } from 'zustand/vanilla';

import { agentSessionPhase, agentWorkStatus } from '@/features/agent/domain/session';
import { upsertAgentTab, type AgentWorkspaceState } from '@/features/agent/domain/workspace';

import type { AgentSessionRuntime } from './session-runtime';

export function syncAgentTab(
  store: StoreApi<AgentWorkspaceState>,
  id: string,
  session: AgentSessionRuntime,
): void {
  const state = session.store.getState();
  const workspace = store.getState();
  const previous = workspace.tabs.find((tab) => tab.id === id);
  const transcriptModified = Math.max(
    0,
    ...state.transcript.flatMap((block) =>
      'at' in block && block.at !== undefined ? [block.at] : [],
    ),
  );
  const hasContent = state.transcript.length > 0;
  const hasDraft = Boolean(state.draft || state.context.length || state.skill);
  const lastModified = Math.max(
    hasDraft && !previous?.hasDraft ? Date.now() : 0,
    state.lastModified,
    transcriptModified,
    previous?.lastModified ?? 0,
  );
  store.setState(
    upsertAgentTab(workspace, {
      agent: state.agent,
      blank: session.isBlank(),
      hasContent,
      id,
      lastModified,
      nativeSessionId: state.nativeSessionId,
      phase: agentSessionPhase(state.connection),
      status: agentWorkStatus(state),
      hasDraft,
      scope: state.scope,
      title:
        !hasContent && !state.titleEdited && state.draft.trim()
          ? state.draft.trim().slice(0, 80)
          : state.title,
    }),
    true,
  );
}

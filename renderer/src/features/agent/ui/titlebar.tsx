import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { scopeLabel } from '@/features/agent/domain/session';

import { AGENT_ICONS } from './identity/agent-icons';

const AGENT_LABELS = {
  stashbase: 'Built-in',
  codex: 'Codex',
  claude: 'Claude Code',
} as const;

export function AgentTitlebar({ runtime }: { runtime: AgentWorkspaceRuntime }) {
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const active = runtime.session(activeId) ?? runtime.activeSession();
  const state = useStore(
    active.store,
    useShallow((session) => ({
      agent: session.agent,
      scope: session.scope,
      title: session.title,
    })),
  );
  const Icon = AGENT_ICONS[state.agent];
  return (
    <div
      aria-label={`${state.title}, ${AGENT_LABELS[state.agent]}, ${scopeLabel(state.scope)}`}
      className="relative flex min-w-0 flex-1 items-center justify-center"
    >
      <span className="flex max-w-[min(28rem,60vw)] min-w-0 items-center gap-2 text-caption font-medium text-foreground">
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{state.title}</span>
      </span>
      <span className="absolute right-0 hidden text-[11px] text-muted-foreground md:block">
        {scopeLabel(state.scope)}
      </span>
    </div>
  );
}

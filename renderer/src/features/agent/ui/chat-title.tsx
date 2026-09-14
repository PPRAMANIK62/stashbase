/** The active Chat's name for the workspace titlebar: the Agent's mark and
 *  the conversation's title, centred in the row's shared slot while the
 *  Chat has the whole card and the pane draws no name row of its own. It
 *  names and does not rename: the Chats panel beside it owns renaming. */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { agentLabel } from '@/features/agent/domain/agent-catalog';
import { agentSessionIsUnstarted } from '@/features/agent/domain/session';
import { cn } from '@/lib/utils';
import { AGENT_ICONS } from '@/shared/brand/agent-icons';

export function ChatTitle({ runtime }: { runtime: AgentWorkspaceRuntime }) {
  const activeId = useStore(runtime.store, (state) => state.activeId);
  const active = runtime.session(activeId) ?? runtime.activeSession();
  const state = useStore(
    active.store,
    useShallow((current) => ({
      agent: current.agent,
      title: current.title,
      unstarted: agentSessionIsUnstarted(current),
    })),
  );
  const Icon = AGENT_ICONS[state.agent];
  return (
    <span
      aria-label={`${state.title}, ${agentLabel(state.agent)}`}
      aria-level={2}
      className="flex min-w-0 items-center gap-1.5 text-caption"
      role="heading"
      title={state.title}
    >
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      {/* An unstarted Chat's default name stays quiet, the same voice the
       *  pane's own row gives it; a named conversation reads as the title. */}
      <span
        className={cn(
          'min-w-0 truncate',
          state.unstarted ? 'text-muted-foreground' : 'font-medium text-foreground',
        )}
      >
        {state.title}
      </span>
    </span>
  );
}

import type { AgentKind } from '@/features/agent-panel/components/agentCatalog';
import { makeChatTab, type Action, type State } from '@/store/state/state';
import { newChatPlan } from '@/features/agent-panel/lib/folderState';

/** Open or reuse a chat tab without starting runtime installation. A missing
 * runtime is owned by AgentView's explicit `Install and continue` gate; tab
 * activation alone is never consent to download another Agent. */
export function activateChatTabForAgent(
  state: Pick<State, 'chatTabs' | 'chatOpen'>,
  dispatch: (action: Action) => void,
  agent: AgentKind,
): void {
  const plan = newChatPlan(state.chatTabs, agent);
  if (plan.kind === 'reuse') {
    if (plan.switchAgent) dispatch({ type: 'CHAT_TAB_SET_AGENT', id: plan.id, agent });
    dispatch({ type: 'CHAT_TAB_ACTIVATE', id: plan.id });
  } else {
    dispatch({ type: 'CHAT_TAB_NEW', tab: makeChatTab(agent, state.chatTabs) });
  }
  if (!state.chatOpen) dispatch({ type: 'CHAT_TOGGLE' });
}

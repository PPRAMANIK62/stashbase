/**
 * Chrome-row chat launchers — one icon-only button per agent (Claude,
 * Codex), VSCode-style. Each icon selects its agent's most recently active
 * tab, creates a tab only when that agent has none, and toggles the panel
 * closed when clicked again while active. The in-panel `+` creates new tabs.
 *
 */
import { useEffect, useRef } from 'react';
import { api, type Agent, type AgentsResponse } from '../api';
import { AGENTS, type AgentMeta } from '../agentCatalog';
import { useApp } from '../store/AppContext';
import { useHoverTip } from '../hooks/useHoverTip';
import { makeChatTab } from '../store/state';

export function ChatLaunchButtons() {
  const { state, dispatch } = useApp();
  const refreshedRef = useRef(false);

  // Prime the agent registry once. AgentView refreshes it after every
  // connection outcome so runtime failures and retries stay visible.
  useEffect(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    api.listAgents().then((r: AgentsResponse) => {
      dispatch({ type: 'AGENTS_LOADED', agents: r.clis });
    }).catch(() => { /* renderer falls back to local defaults */ });
  }, [dispatch]);

  const activeTab = state.chatTabs.find((t) => t.id === state.activeChatTabId);

  function toggleAgent(agentId: string) {
    const hasOpenTab = state.chatTabs.some((tab) => tab.agent === agentId);
    dispatch({
      type: 'CHAT_AGENT_TOGGLE',
      agent: agentId,
      tab: hasOpenTab ? undefined : makeChatTab(agentId, state.chatTabs),
    });
  }

  return (
    <div className="chat-launchers">
      {AGENTS.map((agent) => (
        <LaunchButton
          key={agent.id}
          agent={agent}
          runtime={state.agents.find((runtime) => runtime.id === agent.id)}
          active={state.chatOpen && activeTab?.agent === agent.id}
          onClick={() => toggleAgent(agent.id)}
        />
      ))}
    </div>
  );
}

/** One launcher. Its own component so `useHoverTip` isn't called in a map
 *  callback. Uses the shared custom tooltip because these live in the
 *  `app-chrome` drag region, where the native `title` tooltip never
 *  appears. Tip drops below — they sit at the top-right of the window. */
function LaunchButton({
  agent,
  runtime,
  active,
  onClick,
}: {
  agent: AgentMeta;
  runtime?: Agent;
  active: boolean;
  onClick: () => void;
}) {
  const unavailable = runtime?.state === 'unavailable';
  const label = runtime?.state && runtime.state !== 'available'
    ? `${agent.launcherLabel} is ${runtime.state}${runtime.error ? `: ${runtime.error}` : ''}`
    : active ? `Hide ${agent.launcherLabel} chat` : `Show ${agent.launcherLabel} chat`;
  const Icon = agent.Icon;
  const { tipProps, tip } = useHoverTip(label, 'bottom');
  return (
    <button
      className={'icon-btn chat-launch' + (active ? ' active' : '')}
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={unavailable}
      {...tipProps}
    >
      <Icon />
      {tip}
    </button>
  );
}

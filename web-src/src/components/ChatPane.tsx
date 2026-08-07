/**
 * Right-side chat panel — Cursor-style tabbed chats. Each tab in
 * `state.chatTabs` renders a structured agent panel. Claude routes to the
 * Claude Agent SDK bridge; Codex routes to the Codex app-server bridge.
 * All tabs stay mounted at once so switching preserves each session's
 * state (inactive tabs are absolutely-positioned + `visibility: hidden`).
 * Chrome-row agent icons select or toggle existing chats; this panel's
 * per-agent `+` button is the explicit new-chat control.
 */
import * as React from 'react';
import type { ReactNode } from 'react';
import { AgentView } from './AgentView';
import { LazyLoadBoundary } from './ErrorBoundary';
import { agentMeta, isAgentKind } from '../agentCatalog';
import { cn } from '../lib/utils';
import { useApp } from '../store/AppContext';
import { rememberPreferredAgent } from '../agentPreference';

/** One tab body. Inactive panes stay mounted (preserving each session's
 *  state) but render invisible and inert. */
const tabPaneClass = 'absolute inset-0 flex flex-col';

/** The inside of one tab body; `status` styles the "no active chat" notice
 *  and the lazy-load error fallback. */
export const chatStatusClass =
  'flex min-h-0 flex-1 flex-col overflow-hidden px-4.5 py-4 text-sm text-muted-foreground';

/** Brand glyph for a tab's agent, shown before its title. */
function AgentGlyph({ agent }: { agent: string }) {
  const Icon = agentMeta(agent).Icon;
  return <Icon className="size-3.25 shrink-0" />;
}

export function ChatSessionBoundary({
  tabId,
  active,
  children,
}: {
  tabId: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <LazyLoadBoundary
      className={chatStatusClass}
      label="chat session"
      resetKey={`${tabId}:${active ? 'active' : 'inactive'}`}
    >
      {children}
    </LazyLoadBoundary>
  );
}

export function ChatPane() {
  const { state, dispatch } = useApp();
  // The panel renders with or without a window folder: chats are scoped
  // per tab (a library folder, or the whole library), so a no-folder
  // window can still hold library-wide chats.
  const tabs = state.chatTabs;
  const activeId = state.activeChatTabId;

  return (
    <div
      className="chat-pane-shell"
      aria-hidden={!state.chatOpen || undefined}
      inert={!state.chatOpen || undefined}
    >
      {/* Cursor-style tab strip. Scrolls horizontally when many tabs are
        * open; new tabs come from the chrome-row launchers, so it is
        * tabs-only. */}
      <div className="flex min-h-8 items-stretch gap-1 px-1.5 pt-1.5 pb-1">
        <div className="flex flex-1 gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'group/tab inline-flex max-w-45 min-w-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-transparent border-b-0 py-1 pr-1.5 pl-2.5 text-sm whitespace-nowrap text-muted-foreground select-none hover:bg-muted hover:text-foreground',
                tab.id === activeId && 'border-border bg-background pb-1.25 font-medium text-foreground hover:bg-background',
              )}
              role="tab"
              aria-selected={tab.id === activeId}
              onClick={() => {
                if (isAgentKind(tab.agent)) rememberPreferredAgent(tab.agent);
                dispatch({ type: 'CHAT_TAB_ACTIVATE', id: tab.id });
              }}
              title={tab.title}
            >
              <AgentGlyph agent={tab.agent} />
              {/* min-w-0 lets the label shrink so the ellipsis renders. */}
              <span className="min-w-0 overflow-hidden text-ellipsis">{tab.title}</span>
              <button
                type="button"
                className={cn(
                  'size-4.5 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent text-lg/none text-muted-foreground hover:bg-muted hover:text-foreground',
                  // Hidden by default — surfaces on tab hover or for the
                  // active tab, avoiding clutter with many tabs open.
                  tab.id === activeId ? 'opacity-100' : 'opacity-0 group-hover/tab:opacity-100',
                )}
                aria-label={`Close ${tab.title}`}
                title="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'CHAT_TAB_CLOSE', id: tab.id });
                }}
              >×</button>
            </div>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(tabPaneClass, tab.id === activeId ? 'visible' : 'invisible pointer-events-none')}
            role="tabpanel"
            aria-hidden={tab.id !== activeId}
          >
            <ChatSessionBoundary tabId={tab.id} active={tab.id === activeId}>
              <AgentView
                active={tab.id === activeId}
                id={tab.id}
                title={tab.title}
                agent={isAgentKind(tab.agent) ? tab.agent : 'claude'}
              />
            </ChatSessionBoundary>
          </div>
        ))}
        {tabs.length === 0 && (
          <div className={chatStatusClass}>
            No active chat. Click <strong>New Chat</strong> in the sidebar, or
            the <strong>Claude</strong> / <strong>Codex</strong> button in the
            top bar, to start one.
          </div>
        )}
      </div>
    </div>
  );
}

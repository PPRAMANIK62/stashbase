import { Suspense, useRef, useState } from 'react';
import { HistoryIcon } from '../icons';
import { requestAgentBootstrap } from '../agentBootstrap';
import type { AgentKind } from '../agentCatalog';
import { useApp } from '../store/AppContext';
import { makeChatTab, type Action, type State } from '../store/state';
import { newChatPlan } from './agent/folderState';
import type { HistoryScope } from './agent/sessionHistory';
import { lazyWithRetry } from './ErrorBoundary';
import { Button } from './ui/button';
import { PopupLoadingStatus } from './ui/status';

/** The merged session-history popover loads at its interaction boundary
 *  so react-aria (which otherwise ships with the lazy chat chunk) stays
 *  out of the initial renderer bundle. */
const SessionHistoryPopover = lazyWithRetry(() =>
  import('./agent/SessionHistoryMenu').then((mod) => ({ default: mod.SessionHistoryMenu })));

/** Ensure the chat panel is open with a tab running `agent` active — the
 *  blank-tab reuse rule shared by New Chat, the History resume path, and
 *  the titlebar chat toggle (its open-with-no-tabs case):
 *  reuse the one COMPLETELY blank tab (switching its agent in place when
 *  it differs), else create a fresh tab; open the panel when hidden. */
export function activateChatTabForAgent(
  state: Pick<State, 'chatTabs' | 'chatOpen'>,
  dispatch: (a: Action) => void,
  agent: AgentKind,
) {
  requestAgentBootstrap(agent, dispatch);
  const plan = newChatPlan(state.chatTabs, agent);
  if (plan.kind === 'reuse') {
    if (plan.switchAgent) dispatch({ type: 'CHAT_TAB_SET_AGENT', id: plan.id, agent });
    dispatch({ type: 'CHAT_TAB_ACTIVATE', id: plan.id });
  } else {
    dispatch({ type: 'CHAT_TAB_NEW', tab: makeChatTab(agent, state.chatTabs) });
  }
  if (!state.chatOpen) dispatch({ type: 'CHAT_TOGGLE' });
}

/** History clock on a sidebar scope header: opens the merged
 *  session-history menu for that scope (both agents' sessions, newest
 *  first). Picking a session records a pending resume in the store and
 *  ensures a suitable chat tab is active (the New Chat blank-tab reuse
 *  rule); that tab's AgentView consumes the request and resumes the
 *  session within this scope. */
export function ScopeHistoryButton({
  scope,
  label,
  onOpenChange,
}: {
  scope: HistoryScope;
  /** Accessible name + tooltip, e.g. "Chat history in Notes". */
  label: string;
  /** Lets the owning header hold its hover-revealed cluster visible
   *  while the menu is open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function setOpenReported(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function resumeSession(agent: AgentKind, sessionId: string, folder: string | null) {
    setOpenReported(false);
    // The row's own scope, not the menu's: the all-scope history resumes
    // each session in the folder (or library) it belongs to.
    dispatch({
      type: 'CHAT_RESUME_REQUEST',
      resume: { agent, sessionId, folder },
    });
    activateChatTabForAgent(state, dispatch, agent);
  }

  const rect = open ? buttonRef.current?.getBoundingClientRect() : undefined;

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground aria-expanded:bg-active aria-expanded:text-foreground"
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpenReported(!open)}
      >{/* Explicit size: icon-xs would otherwise render its own 12px
          default, and every sidebar glyph is 14px. */}
        <HistoryIcon className="size-3.5" /></Button>
      {open && (
        <Suspense
          fallback={(
            <PopupLoadingStatus
              label="Opening history…"
              left={rect?.left ?? 0}
              top={(rect?.bottom ?? 0) + 4}
              onCancel={() => setOpenReported(false)}
            />
          )}
        >
          <SessionHistoryPopover
            scope={scope}
            ariaLabel={label}
            triggerRef={buttonRef}
            onClose={() => setOpenReported(false)}
            onResume={resumeSession}
          />
        </Suspense>
      )}
    </>
  );
}

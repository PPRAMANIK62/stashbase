import { useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDownIcon, PlusIcon } from '@/common/components/icons';
import { Menu, type MenuItem } from '@/common/components/Menu';
import { Button } from '@/common/components/ui/button';
import {
  AGENT_META,
  AGENTS,
  wikiAgentLauncherDetail,
  type AgentKind,
} from '@/common/lib/agentCatalog';
import {
  accountSignedInSnapshot,
  subscribeAccountSignedIn,
} from '@/common/lib/accountEvents';
import {
  newChatAgentSelectionPlan,
  readPreferredAgent,
  rememberPreferredAgent,
} from '@/common/lib/agentPreference';
import { ALL_HISTORY_SCOPE } from '@/common/lib/libraryScope';
import { useAppActions } from '@/store/contexts/AppContext';
import { ScopeHistoryButton } from './ScopeHistoryButton';

/** Full-width New Chat entry at the sidebar's top (Cursor's "New
 *  Agent" position) — the app's ONE chat-creation entry point, a split
 *  button. The main area starts a chat with the last-selected agent; the
 *  agent picker beside it only chooses the agent the next main-area click
 *  will use. That click reuses the one completely blank tab regardless
 *  of its agent (switching the blank tab's agent in place when it differs —
 *  `newChatPlan`); any content, draft, attachments, or resumed session means
 *  a fresh tab instead. It opens the chat panel when hidden. The
 *  reused/created tab's scope resolves to the window default (current folder,
 *  else Library) on connect, so no scope needs to be threaded here. */
export function NewChatButton() {
  const { actions } = useAppActions();
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const pickerRef = useRef<HTMLButtonElement | null>(null);
  const accountSignedIn = useSyncExternalStore(
    subscribeAccountSignedIn,
    accountSignedInSnapshot,
    accountSignedInSnapshot,
  );

  function startChat(agent: AgentKind) {
    actions.activateChatTab(agent);
  }

  /** Picking from the agent picker only updates the next-chat preference. Chat
   *  creation stays behind the main New Chat action. */
  function pickAgent(agent: AgentKind) {
    const plan = newChatAgentSelectionPlan(agent);
    rememberPreferredAgent(plan.preferredAgent);
    if (plan.startAgent) startChat(plan.startAgent);
    setMenuAnchor(null);
  }

  /* Agent NAMES, not "New <Agent> Chat": the row itself says New Chat and
   * the picker beside it names its agent, so the menu only changes that
   * name — repeating the whole action per item read as three ways to do
   * the same thing. */
  const agentItems: MenuItem[] = AGENTS.map((agent) => ({
    label: agent.launcherLabel,
    detail: agent.id === 'stashbase' ? wikiAgentLauncherDetail(accountSignedIn) : undefined,
    icon: <agent.Icon />,
    onSelect: () => pickAgent(agent.id),
  }));

  // Read at render time, no state: the picker closes its menu after writing,
  // while the other rememberPreferredAgent call sites also dispatch a store
  // update, so this row re-renders with the latest app-wide preference.
  const preferred = AGENT_META[readPreferredAgent()];

  return (
    /* A quiet full-width pill row (Cursor's "New Agent" treatment), not a
     * boxed button — the sidebar's rows carry the hierarchy. There is no
     * keyboard shortcut, so no hint is shown.
     *
     * The row holds THREE targets, so the row itself is pure layout and
     * owns no hover surface. It used to carry `hover:bg-muted` across its
     * whole width, which meant pointing at the 20px agent picker lit a
     * 250px slab and promised a press that wide. Worse, every control in
     * here is a ghost `Button` whose own hover is that same `muted` token,
     * so each one repainted the colour already under it: three targets,
     * one undifferentiated highlight that looked like precise feedback and
     * was none. With the row transparent, each child's existing hover
     * finally traces the box that will actually be pressed. One rule:
     * hover marks the target, structure marks the grouping. */
    <div className="flex-none px-1.5 pt-2 pb-3">
      <div className="flex min-h-7 w-full items-center rounded-md">
        <Button
          variant="ghost"
          size="sm"
          // h-auto/min-h-7 keeps the row's own height rule; the ghost hover
          // now paints only this button's own flex-1 box.
          className="h-auto min-h-7 min-w-0 flex-1 justify-start gap-2 px-2 text-left text-base font-normal text-foreground"
          title={`Start a ${preferred.launcherLabel} chat in the current folder, or across the whole library`}
          onClick={() => startChat(readPreferredAgent())}
        >
          {/* A PLUS, not the agent's mark: this row's job is "make a new
            * chat", and leading with a vendor glyph made the action read
            * as "Codex" with a label attached. Which agent it will use
            * now rides inside the picker that changes it. 16px slot
            * around the 14px glyph — every row does
            * this, so the label lands on the shared 38px gutter line. */}
          <span className="inline-flex size-4 flex-none items-center justify-center">
            <PlusIcon className="size-3.5 text-muted-foreground" />
          </span>
          <span className="min-w-0 truncate">New Chat</span>
        </Button>
        {/* The agent this row will start, named INSIDE its picker — the row
          * would otherwise give no clue which of the two runs, and the menu
          * is where it changes. The name is part of the control rather than
          * a label beside it: a word sitting immediately left of a chevron
          * reads as one target, so pressing "Codex" and hitting a dead span
          * next to the live arrow is a miss the layout invited. One button
          * also gives the pair a single hover and focus ring. */}
        <Button
          ref={pickerRef}
          variant="ghost"
          size="xs"
          /* `size="xs"` supplies the whole shape — h-6, px-2, gap-1 — so
           * this control comes out 24px on the `-ui` corner, matching the
           * history clock beside it and the New Chat button it modifies.
           * It carries almost no overrides on purpose: once the agent name
           * moved INSIDE the button, this stopped being an icon button and
           * became an item that takes a hover background, and the corner
           * contract gives `-control`/`rounded-sm` only to sub-24px ICON
           * buttons. Hand-sizing it (h-5, rounded-sm, a 16px glyph) made
           * its hover box shorter and sharper-cornered than every
           * neighbour, so the one row showed three different hover shapes.
           * `font-normal` because this is a quiet label, not a button word
           * — the New Chat button does the same. 14px glyph, the sidebar's
           * shared size. Always visible, muted: name plus arrow IS the
           * discoverability of the agent menu — hover-only would hide the
           * affordance. While the menu is open the control takes `active`,
           * a step BRIGHTER than the `muted` hover: ghost's own
           * `aria-expanded` is that same hover token, so the trigger went
           * invisible exactly when the pointer left it for the menu.
           * `ScopeHistoryButton` already pairs the tokens this way. */
          className="ml-1 min-w-0 flex-none font-normal text-muted-foreground aria-expanded:bg-active aria-expanded:text-foreground [&_svg]:size-3.5"
          aria-label="Choose agent for new chat"
          aria-haspopup="menu"
          aria-expanded={!!menuAnchor}
          onClick={() => {
            if (menuAnchor) { setMenuAnchor(null); return; }
            const rect = pickerRef.current?.getBoundingClientRect();
            if (rect) setMenuAnchor(rect);
          }}
        >
          <span className="min-w-0 truncate">{preferred.launcherLabel}</span>
          <ChevronDownIcon />
        </Button>
        {/* ALL chat history lives on this row since the Library section
          * retired — with no per-folder rows left, this is the one place
          * every session (each member folder + the library scope) stays
          * reachable; rows resume in their own scope.
          *
          * It sits AFTER the picker, behind a hairline. History is a
          * DESTINATION; New Chat and the agent it will use are one action
          * and its modifier. Parking the clock between them put an
          * unrelated control inside a bonded pair, and no hover treatment
          * reads correctly while the layout says the picker belongs to the
          * clock. The rule divides at the real boundary, so the grouping
          * is legible at rest instead of only under the pointer.
          *
          * Present in the BARE window too: this row is the one entry to
          * every session, the bare Library can hold Library-scoped chats
          * of its own, and a folder-scoped row resumed from here reopens
          * its folder — history is exactly how "which folder was that
          * chat in?" gets answered. Hiding the clock until a folder opens
          * makes those sessions unreachable from the state where the user
          * is most likely to be looking for them. */}
        {/* h-4 matches the titlebar's search|folder hairline
          * (TitlebarControls.tsx) — the two sit stacked at the sidebar's
          * top, so unequal heights read as a mistake. */}
        <span aria-hidden className="mx-1 h-4 w-px flex-none bg-border" />
        <ScopeHistoryButton
          scope={ALL_HISTORY_SCOPE}
          label="Chat history"
        />
      </div>
      {menuAnchor && (
        <Menu
          anchor={{ rect: menuAnchor, align: 'right' }}
          minWidth={210}
          items={agentItems}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </div>
  );
}

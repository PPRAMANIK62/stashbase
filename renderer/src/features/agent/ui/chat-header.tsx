/** The Chat pane's own name row: the Agent's mark and the conversation's
 *  title, left-aligned at the top of the pane in both layouts, so the pane
 *  says which Chat it is whether or not the titlebar is busy with document
 *  tabs, with the conversation's own actions at the row's right end. The
 *  row draws no rule; the transcript fades out beneath it, the same way it
 *  fades in above the composer. Once the Chat has started the title renames
 *  in place on a click or F2, the same rename the Chats panel offers its
 *  rows, and a pencil surfaces on hover and focus to say so; an unstarted
 *  Chat's default name is plain text, because there is no conversation to
 *  name yet.
 *
 *  The row is drawn in both layouts and says nothing in one of them. With the
 *  whole card the titlebar names the chat and the Chats panel manages the
 *  history, so there is nothing for the row to carry — but removing it would
 *  move everything under it, including where the composer sits, every time the
 *  reader crosses between the two. It stands empty instead, keeping its height
 *  and the fade the transcript scrolls under, so the pane's rhythm is the same
 *  in both. */
import { Pencil } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { caretOffsetAtPoint, InlineInput } from '@/components/ui/inline-input';
import type { AgentSessionRuntime } from '@/features/agent/application/session-runtime';
import { agentLabel } from '@/features/agent/domain/agent-catalog';
import { agentSessionIsUnstarted } from '@/features/agent/domain/session';
import { fontWeights } from '@/lib/font-weight';
import { cn } from '@/lib/utils';
import { AGENT_ICONS } from '@/shared/brand/agent-icons';
import { FailureLine } from '@/shared/ui/failure-notice';

export function ChatHeader({
  blank = false,
  failure,
  onRename,
  session,
  trailing,
}: {
  /** Keeps the row's height and its fade but draws nothing in it, for the
   *  layout that names the chat somewhere else. */
  blank?: boolean;
  /** Why the last rename was refused, or null. */
  failure: string | null;
  onRename(session: AgentSessionRuntime, title: string): void;
  session: AgentSessionRuntime;
  /** The conversation's own actions, at the row's right end. */
  trailing?: ReactNode;
}) {
  const state = useStore(
    session.store,
    useShallow((current) => ({
      agent: current.agent,
      title: current.title,
      unstarted: agentSessionIsUnstarted(current),
    })),
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [caretOffset, setCaretOffset] = useState<number | undefined>(undefined);
  const Icon = AGENT_ICONS[state.agent];

  const beginEdit = (offset?: number) => {
    setCaretOffset(offset);
    setDraft(state.title);
  };
  const cancelEdit = () => setDraft(null);
  const commitEdit = () => {
    const next = draft?.trim() ?? '';
    setDraft(null);
    if (!next || next === state.title) return;
    onRename(session, next);
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // A keyboard press has no point to place the caret at, so it lands at
    // the end; a pointer press puts it where the reader clicked.
    if (event.detail === 0) {
      beginEdit();
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target : event.currentTarget;
    beginEdit(caretOffsetAtPoint(target, event.clientX, event.clientY));
  };

  return (
    <div
      aria-hidden={blank || undefined}
      className="relative flex h-10 shrink-0 items-center gap-2 px-4"
      inert={blank || undefined}
    >
      {/* The transcript's top edge fades into the row rather than meeting a
       *  rule, mirroring the fade above the composer at its other end. Over
       *  an empty canvas the same-colour gradient is invisible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full z-10 h-4 bg-gradient-to-b from-surface-2 to-transparent"
      />
      {!blank && (
        <>
          {/* The mark stands alone beside the title, so it takes the chrome's
           *  stroke rather than the heavier one it wears beside the vendor
           *  logos: 1.75 over the feather's 32-unit box paints 0.875px at 16px,
           *  the weight of every resting glyph around it. The vendor marks
           *  ignore the prop. */}
          <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          {state.unstarted ? (
            // No turn has left yet and nothing backs the chat, so there is
            // nothing to rename: the default name stays quiet so the greeting is
            // the empty state's one anchor. The label sits where the control's
            // text will, so the row does not shift when the first turn makes it
            // one.
            <span
              aria-label={`${state.title}, ${agentLabel(state.agent)}`}
              aria-level={2}
              className="min-w-0 truncate text-body text-muted-foreground"
              role="heading"
              title={state.title}
            >
              {state.title}
            </span>
          ) : draft === null ? (
            <Button
              aria-label={`${state.title}, ${agentLabel(state.agent)}`}
              className={cn(
                // The same voice as a sidebar file row: body size, regular
                // weight, muted at rest and ink under the pointer.
                '-ml-1.5 max-w-[min(28rem,100%)] min-w-0 justify-start px-1.5 text-body',
                // The primitive's own label spans are flex items with an auto
                // minimum, so a long title would run past the button; letting
                // them shrink is what gives the label its ellipsis.
                '[&>span:last-child]:min-w-0 [&>span:last-child>span]:min-w-0',
              )}
              onClick={handleClick}
              onKeyDown={(event) => {
                if (event.key === 'F2') {
                  event.preventDefault();
                  beginEdit();
                }
              }}
              size="compact"
              title={state.title}
              variant="ghost"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate">{state.title}</span>
                {/* The pencil keeps its room and only fades in, so the pill's
                 *  width does not jump under the pointer. */}
                <Pencil
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100"
                  strokeWidth={1.5}
                />
              </span>
            </Button>
          ) : (
            <InlineInput
              aria-label={`Rename ${state.title}`}
              className="-ml-1.5 h-7 max-w-[28rem] px-1.5 text-body"
              {...(caretOffset === undefined ? {} : { caretOffset })}
              onCancel={cancelEdit}
              onChange={setDraft}
              onCommit={commitEdit}
              style={{ fontVariationSettings: fontWeights.normal }}
              value={draft}
            />
          )}
          {failure && (
            <FailureLine as="span" className="min-w-0 truncate" tone="input">
              {failure}
            </FailureLine>
          )}
          {/* The row's 16px inset is the text's; the compact action square pulls
           *  back 8px so its box meets the panel toggle's 8px inset in the corner
           *  above it and its glyph's centre, 14px in from its edge, lands on
           *  that toggle's column (8px + 14px). */}
          {trailing && (
            // gap-1 between 28px squares is the 32px glyph pitch the sidebar's
            // band keeps between its own squares, so every toolbar in the window
            // runs at one pitch.
            <div className="-mr-2 ml-auto flex shrink-0 items-center gap-1">{trailing}</div>
          )}
        </>
      )}
    </div>
  );
}

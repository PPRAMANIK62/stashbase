/** The Chat pane's own name row: the Agent's mark and the conversation's
 *  title, left-aligned at the top of the pane in both layouts, so the pane
 *  says which Chat it is whether or not the titlebar is busy with document
 *  tabs. The row draws no rule; the transcript fades out beneath it, the
 *  same way it fades in above the composer. Once the Chat has started the
 *  title renames in place on a click or F2, the same rename the Chats panel
 *  offers its rows, and a pencil surfaces on hover and focus to say so; an
 *  unstarted Chat's default name is plain text, because there is no
 *  conversation to name yet. */
import { Pencil } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { caretOffsetAtPoint, InlineInput } from '@/components/ui/inline-input';
import type { AgentSessionRuntime } from '@/features/agent/application/session-runtime';
import { agentLabel } from '@/features/agent/domain/agent-catalog';
import { agentSessionIsUnstarted } from '@/features/agent/domain/session';
import { fontWeights } from '@/lib/font-weight';
import { cn } from '@/lib/utils';

import { AGENT_ICONS } from './identity/agent-icons';

export function ChatHeader({
  failure,
  onRename,
  session,
}: {
  /** Why the last rename was refused, or null. */
  failure: string | null;
  onRename(session: AgentSessionRuntime, title: string): void;
  session: AgentSessionRuntime;
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
    <div className="relative flex h-10 shrink-0 items-center gap-2 px-4">
      {/* The transcript's top edge fades into the row rather than meeting a
       *  rule, mirroring the fade above the composer at its other end. Over
       *  an empty canvas the same-colour gradient is invisible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full z-10 h-4 bg-gradient-to-b from-surface-2 to-transparent"
      />
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
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
        <span className="min-w-0 truncate text-caption text-destructive" role="alert">
          {failure}
        </span>
      )}
    </div>
  );
}

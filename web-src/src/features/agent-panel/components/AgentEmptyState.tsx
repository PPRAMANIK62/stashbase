/**
 * Empty-chat hero pieces. While a chat has no turns, AgentView centers the
 * composer in the panel: a title (plus a connecting status when
 * applicable) sits above it. A folder-scoped chat puts the fixed Create Wiki
 * action directly below the composer; a library chat keeps a rotating usage
 * suggestion toward the pane's bottom edge.
 * Pressing the suggestion only prefills the composer draft with that
 * suggestion's full prompt — sending always stays an explicit user action.
 * Folder chats intentionally have no rotating prompt competing with their
 * single first action. Library suggestions talk about the whole library.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/common/components/ui/button';
import { SectionHeading } from '@/common/components/ui/section';
import { ArrowInsertIcon } from '@/common/components/icons';
import { spinnerClass } from '@/features/agent-panel/lib/panelStyles';

interface Suggestion {
  /** The action-first rotating line the user reads. */
  label: string;
  /** The full prompt a press drops into the composer draft. Prompts that
   *  need an object end with ": " or a trailing space — the caret lands
   *  where the user completes them. */
  prompt: string;
}

/* Every entry must carry a useful prompt to prefill. Labels stay short and
 * action-first; prompts expand them into the source-aware journeys StashBase
 * supports. Templates that need user input end at the insertion point. */
const LIBRARY_SUGGESTIONS: Suggestion[] = [
  {
    label: 'Find something I vaguely remember',
    prompt: 'Use meaning, not just exact wording, to search my library and show the most relevant sources about: ',
  },
  {
    label: 'Explain why an earlier decision was made',
    prompt: 'Find where my library explains this decision. Summarize the reasoning, alternatives, and source files: ',
  },
  {
    label: 'Gather context across projects',
    prompt: 'Gather the most relevant context across my library, group it by project or folder, and cite the sources about: ',
  },
  {
    label: 'Compare approaches across my archive',
    prompt: 'Compare how different projects or documents in my library approached this topic. Highlight recurring trade-offs and lessons: ',
  },
  {
    label: 'Find papers comparing two methods',
    prompt: 'Find papers or notes comparing these methods, then summarize the evidence and disagreements: ',
  },
  {
    label: 'Map what’s in my library',
    prompt: 'Survey my library and summarize what each folder contains, its main themes, and likely relationships.',
  },
  {
    label: 'Find recurring themes and open questions',
    prompt: 'Find recurring themes, decisions, and unresolved questions across my library, with representative sources.',
  },
  {
    label: 'Trace a decision across projects',
    prompt: 'Trace how this idea or decision evolved across projects and documents: ',
  },
  {
    label: 'Build a briefing from my sources',
    prompt: 'Build a concise briefing from my library. Separate established facts, prior decisions, conflicting evidence, and open questions about: ',
  },
  {
    label: 'Start a project from existing sources',
    prompt: 'Create a new project seeded with a Markdown Canvas and references to the most relevant sources in my library about: ',
  },
];

/* Slow cadence and a long crossfade keep the rotation ambient — the
 * suggestion should never pull the eye away from the composer. */
const HINT_ROTATE_MS = 6000;
const HINT_FADE_MS = 700;

/** The single rotating usage suggestion for the empty chat, anchored
 * toward the pane's bottom edge below the hero composer. Rotates
 * on a quiet timer with a continuous upward motion: the outgoing line
 * drifts up as it fades and the incoming one rises from below
 * (`chat-hint-rise` in agent-panel.css). The global reduced-motion policy zeroes
 * the keyframe and drops `translate` from transition-property, so the swap
 * degrades to a plain crossfade there. Hover or focus pauses the rotation:
 * a moving press target would swap under the pointer, and a focused
 * button's accessible name must hold still. */
export function EmptyChatSuggestion({ onPrefill }: {
  onPrefill: (text: string) => void;
}) {
  const suggestions = LIBRARY_SUGGESTIONS;
  const count = suggestions.length;
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  useEffect(() => {
    if (paused) {
      // A pause can land mid-swap (pointer arrives during the fade-out);
      // restoring `leaving` brings the current label back to rest.
      setLeaving(false);
      return undefined;
    }
    let swap: number | undefined;
    const cycle = window.setInterval(() => {
      setLeaving(true);
      swap = window.setTimeout(() => {
        setIndex((i) => (i + 1) % count);
        setLeaving(false);
      }, HINT_FADE_MS);
    }, HINT_ROTATE_MS);
    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(swap);
    };
  }, [count, paused]);
  const current = suggestions[index % count];
  return (
    /* Bottom-anchored by AgentView (mt-auto); the pb lifts the line off
     * the pane's bottom edge so it reads placed, not stranded. Centered:
     * far below the hero column, it aligns to the pane's axis, not the
     * composer's content edge. */
    <div className="flex justify-center pt-6 pb-12">
      <Button
        variant="link"
        className="h-auto p-0 text-sm text-muted-foreground no-underline hover:text-foreground hover:no-underline focus-visible:text-foreground"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => onPrefill(current.prompt)}
      >
        <span
          // Remounting per suggestion restarts the rise-in keyframe.
          key={index}
          className="inline-flex items-center gap-1.5 transition-[opacity,translate] duration-fast ease-out"
          style={{
            opacity: leaving ? 0 : 1,
            translate: leaving ? '0 -8px' : '0 0',
            transitionDuration: `${HINT_FADE_MS}ms`,
            animation: `chat-hint-rise ${HINT_FADE_MS}ms var(--motion-ease-out)`,
          }}
        >
          {current.label}
          {/* ↖ marks the line as pressable — it inserts above, it does
            * not send (that is ArrowUpIcon's job on the send button). */}
          <ArrowInsertIcon className="size-3 shrink-0" aria-hidden="true" />
        </span>
      </Button>
    </div>
  );
}

/** The primary first action for a folder. It sends immediately — unlike the
 * rotating library suggestions, this is a complete product action rather
 * than a prompt template that still needs editing.
 *
 * So it wears the app's primary action, unmodified: a solid accent
 * `Button`, the same one the zero-folder sidebar and the empty main pane
 * put under their own one-line invitations. The capsule is the only thing
 * it adds, and it is semantic (see renderer-styling's corner rules) — this
 * is the fixed folder activation path, not an ordinary button drawn as a
 * pill. The tinted-outline treatment it replaces stacked a pale fill, a
 * pale stroke, and pale text: three washes of one hue that together read
 * as a status badge rather than as the thing to press.
 *
 * No leading glyph. The panel's other two hero actions carry none, and the
 * bolt this used to wear is the Auto permission mode's mark two rows
 * below — one glyph cannot mean both. */
export function CreateWikiAction({
  pending,
  onCreate,
  onCancel,
}: {
  pending: boolean;
  onCreate: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 pt-4 text-center">
      <Button className="rounded-full px-4" disabled={pending} onClick={onCreate}>
        {pending ? 'Creating Wiki…' : 'Create Wiki'}
      </Button>
      {pending && (
        // The waiting state's motion lives HERE rather than inside the
        // disabled button: the panel's one connecting arc is an accent
        // stroke, which is invisible on an accent fill, and a dimmed
        // button is the wrong place to look for progress anyway.
        <p className="m-0 flex max-w-measure-sm items-center gap-1.5 text-xs leading-snug text-muted-foreground" role="status">
          <span className={spinnerClass} aria-hidden="true" />
          Waiting for Agent setup. <Button type="button" variant="link" size="xs" className="h-auto border-0 p-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={onCancel}>Cancel</Button>
        </p>
      )}
    </div>
  );
}

/** Title + status slot above the centered composer. The title names the
 * space's promise; runtime identity still lives in the tab icon and the
 * composer's "Message <Agent>…" placeholder, and the scope pill carries
 * the scope — no wordmark or agent branding here. While a session
 * connects, a spinner row shows between the title and the composer. */
export function EmptyChatGreeting({ agentShortName, connecting }: {
  agentShortName: string;
  connecting: boolean;
}) {
  return (
    <>
      {/* Level 2, stated: pane-level surfaces top the chat pane's outline
        * at h2 (see the scheme note on RuntimeCard). */}
      <SectionHeading level={2} className="pb-6 text-center text-2xl">
        Your knowledge is here.
      </SectionHeading>
      {connecting && (
        <p className="m-0 flex items-center justify-center gap-2 pb-4 text-sm text-muted-foreground" role="status">
          <span className={spinnerClass} aria-hidden="true" />
          Connecting to {agentShortName}…
        </p>
      )}
    </>
  );
}

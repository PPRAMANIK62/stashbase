/**
 * Empty-chat hero pieces. While a chat has no turns, AgentView centers the
 * composer in the panel: a connecting status (when applicable) sits above
 * it and a single rotating, clickable usage suggestion sits below it.
 * Pressing the suggestion only prefills the composer draft with that
 * suggestion's full prompt — sending always stays an explicit user action.
 * Copy follows the chat's scope: a folder-bound chat talks about "this
 * folder", a library chat talks about the whole library.
 */
import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { ArrowInsertIcon } from '../../icons';

interface Suggestion {
  /** The rotating line the user reads ("Ask me to …"). */
  label: string;
  /** The full prompt a press drops into the composer draft. Prompts that
   *  need an object end with ": " or a trailing space — the caret lands
   *  where the user completes them. */
  prompt: string;
}

/* Scope-neutral suggestions shared by both lists. Every entry must carry a
 * sensible prompt — pure interaction tips ("Type @ …", "Drop in a file…")
 * have no prompt to prefill and don't belong in this rotation. */
const SHARED_SUGGESTIONS: Suggestion[] = [
  { label: 'Ask me to compare two documents', prompt: 'Compare these two documents: ' },
  { label: 'Ask me to turn notes into an outline', prompt: 'Turn these notes into a structured outline: ' },
  { label: 'Ask me to extract key points and action items', prompt: 'Extract the key points and action items from ' },
  { label: 'Ask me to rewrite or polish a draft', prompt: 'Rewrite and polish this draft: ' },
  { label: 'Ask me to draft a document', prompt: 'Draft a document about ' },
];

const FOLDER_SUGGESTIONS: Suggestion[] = [
  { label: 'Ask me anything about this folder', prompt: 'Answer from my files: ' },
  { label: 'Ask me to summarize your notes', prompt: 'Summarize the notes in this folder and highlight the main themes' },
  { label: 'Ask me to find connections across files', prompt: 'Find connections and recurring themes across the files in this folder' },
  ...SHARED_SUGGESTIONS,
  { label: 'Ask me to organize this folder', prompt: 'Summarize this folder and suggest how to organize it' },
];

const LIBRARY_SUGGESTIONS: Suggestion[] = [
  { label: 'Ask me anything across your library', prompt: 'Answer from my library: ' },
  { label: 'Ask me to summarize your notes', prompt: 'Summarize the notes in my library and highlight the main themes' },
  { label: 'Ask me to find connections across folders', prompt: 'Find connections and recurring themes across the folders in my library' },
  ...SHARED_SUGGESTIONS,
  { label: 'Ask me to survey your library', prompt: 'Summarize the folders in my library and what each contains' },
];

/* Slow cadence and a long crossfade keep the rotation ambient — the
 * suggestion should never pull the eye away from the composer. */
const HINT_ROTATE_MS = 6000;
const HINT_FADE_MS = 700;

/** The single rotating usage suggestion for the empty chat, anchored
 * toward the pane's bottom edge below the hero composer. Rotates
 * on a quiet timer with a continuous upward motion: the outgoing line
 * drifts up as it fades and the incoming one rises from below
 * (`chat-hint-rise` in chat.css). The global reduced-motion policy zeroes
 * the keyframe and drops `translate` from transition-property, so the swap
 * degrades to a plain crossfade there. Hover or focus pauses the rotation:
 * a moving press target would swap under the pointer, and a focused
 * button's accessible name must hold still. */
export function EmptyChatSuggestion({ onPrefill, libraryScoped }: {
  onPrefill: (text: string) => void;
  libraryScoped?: boolean;
}) {
  const suggestions = libraryScoped ? LIBRARY_SUGGESTIONS : FOLDER_SUGGESTIONS;
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
        className="cursor-pointer border-0 bg-transparent p-0 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        onHoverChange={setHovered}
        onFocusChange={setFocused}
        onPress={() => onPrefill(current.prompt)}
      >
        <span
          // Remounting per suggestion restarts the rise-in keyframe.
          key={index}
          className="inline-flex items-center gap-1.5 transition-[opacity,translate] ease-in-out"
          style={{
            opacity: leaving ? 0 : 1,
            translate: leaving ? '0 -8px' : '0 0',
            transitionDuration: `${HINT_FADE_MS}ms`,
            animation: `chat-hint-rise ${HINT_FADE_MS}ms ease-in-out`,
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

/** Status slot above the centered composer. No wordmark or tagline — the
 * tab icon and the composer's "Message <Agent>…" placeholder already carry
 * the runtime identity, and the scope pill carries the scope. Only the
 * connecting status renders here. */
export function EmptyChatGreeting({ agentShortName, connecting }: {
  agentShortName: string;
  connecting: boolean;
}) {
  if (!connecting) return null;
  return (
    <p className="m-0 flex items-center justify-center gap-2 pb-4 text-sm text-muted-foreground" role="status">
      {/* The global reduced-motion policy zeroes this keyframe animation,
        * leaving a static arc while the text still conveys the state. */}
      <span
        className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
        aria-hidden="true"
      />
      Connecting to {agentShortName}…
    </p>
  );
}

/**
 * Empty-chat hero pieces. While a chat has no turns, AgentView centers the
 * composer in the panel: a connecting status (when applicable) sits above it
 * and a row of use-case starter chips sits below it (Cursor-style capsules:
 * icon + short title). Selecting a chip only prefills the composer draft —
 * sending always stays an explicit user action. Copy follows the chat's
 * scope: a folder-bound chat talks about "this folder", a library chat
 * talks about the whole library.
 */
import { useState, type ComponentType, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { EditIcon, FolderIcon, SearchIcon } from '../../icons';

interface StarterTemplate {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}

const FOLDER_STARTERS: StarterTemplate[] = [
  {
    Icon: SearchIcon,
    title: 'Find answers in your docs',
    text: 'Answer from my files: ',
  },
  {
    Icon: EditIcon,
    title: 'Draft a document',
    text: 'Draft a document about ',
  },
  {
    Icon: FolderIcon,
    title: 'Organize this folder',
    text: 'Summarize this folder and suggest how to organize it',
  },
];

const LIBRARY_STARTERS: StarterTemplate[] = [
  {
    Icon: SearchIcon,
    title: 'Find answers in your library',
    text: 'Answer from my library: ',
  },
  {
    Icon: EditIcon,
    title: 'Draft a document',
    text: 'Draft a document about ',
  },
  {
    Icon: FolderIcon,
    title: 'Survey your library',
    text: 'Summarize the folders in my library and what each contains',
  },
];

/** Inline token chip inside a hint sentence — mono, quiet. */
function HintKey({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-muted px-1 py-px font-mono text-[11px] text-foreground">{children}</code>;
}

/* Rotating capability hints. Every line states a real, shipping
 * capability for its scope — folder chats offer @ mentions, library
 * chats do not (they retrieve through library search). Built lazily:
 * module-level JSX executes on import, which breaks under the classic
 * JSX transform the node test loader applies to this file. */
const folderHints = (): ReactNode[] => [
  <>Type <HintKey>@</HintKey> to bring a file from this folder into context</>,
  <>Type <HintKey>/</HintKey> to use a skill from your Agent runtime</>,
  <>Drop files or paste an image to attach them</>,
];
const libraryHints = (): ReactNode[] => [
  <>Answers draw on every folder in your library</>,
  <>Type <HintKey>/</HintKey> to use a skill from your Agent runtime</>,
  <>Drop files or paste an image to attach them</>,
];

/** Bottom-anchored capability hint for the empty chat. One muted line,
 * picked per mount — it fills the void below the starters with something
 * true and useful, so the empty state reads intentional rather than
 * unfinished. */
export function EmptyChatHint({ libraryScoped }: { libraryScoped?: boolean }) {
  const hints = libraryScoped ? libraryHints() : folderHints();
  const [index] = useState(() => Math.floor(Math.random() * hints.length));
  return (
    <p className="m-0 pt-6 pb-3 text-center text-xs text-muted-foreground">
      {hints[index % hints.length]}
    </p>
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

export function StarterTemplates({ onPrefill, libraryScoped }: {
  onPrefill: (text: string) => void;
  libraryScoped?: boolean;
}) {
  const starters = libraryScoped ? LIBRARY_STARTERS : FOLDER_STARTERS;
  return (
    <div className="flex flex-wrap gap-2 pt-5">
      {starters.map((starter) => (
        <Button
          key={starter.title}
          // The full radius is the one sanctioned pill shape in the app:
          // starter chips are transient content-level suggestions, not
          // chrome controls (see design-docs/visual-style.md).
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          onPress={() => onPrefill(starter.text)}
        >
          <starter.Icon className="size-3.5 shrink-0 text-muted-foreground" />
          {starter.title}
        </Button>
      ))}
    </div>
  );
}

/**
 * Empty-chat hero pieces. While a chat has no turns, AgentView centers the
 * composer in the panel: a quiet runtime greeting sits above it and use-case
 * starter templates sit below it (Cursor-style rows: icon, title, one-line
 * description). Selecting a template only prefills the composer draft —
 * sending always stays an explicit user action. Copy follows the chat's
 * scope: a folder-bound chat talks about "this folder", a library chat
 * talks about the whole library.
 */
import type { ComponentType } from 'react';
import { Button } from 'react-aria-components';
import { ChevronDownIcon, EditIcon, FolderIcon, SearchIcon } from '../../icons';

interface StarterTemplate {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  text: string;
}

const FOLDER_STARTERS: StarterTemplate[] = [
  {
    Icon: SearchIcon,
    title: 'Find answers in your docs',
    description: 'Ask a question, answered from the files in this folder',
    text: 'Answer from my files: ',
  },
  {
    Icon: EditIcon,
    title: 'Draft a document',
    description: 'Write a design doc, report, or summary from your notes',
    text: 'Draft a document about ',
  },
  {
    Icon: FolderIcon,
    title: 'Organize this folder',
    description: 'Summarize what is here and suggest a cleaner structure',
    text: 'Summarize this folder and suggest how to organize it',
  },
];

const LIBRARY_STARTERS: StarterTemplate[] = [
  {
    Icon: SearchIcon,
    title: 'Find answers in your library',
    description: 'Ask a question, answered from any folder you have added',
    text: 'Answer from my library: ',
  },
  {
    Icon: EditIcon,
    title: 'Draft a document',
    description: 'Write a design doc, report, or summary from your notes',
    text: 'Draft a document about ',
  },
  {
    Icon: FolderIcon,
    title: 'Survey your library',
    description: 'Summarize the folders here and what each one holds',
    text: 'Summarize the folders in my library and what each contains',
  },
];

/** Small wordmark row above the centered composer. The runtime identity is
 * demoted to a caption; the composer itself is the visual focus. While the
 * session connects the guidance line becomes the spinner + muted text. */
export function EmptyChatGreeting({ name, agentShortName, Icon, connecting, libraryScoped }: {
  name: string;
  agentShortName: string;
  Icon: ComponentType<{ className?: string }>;
  connecting: boolean;
  libraryScoped?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 pb-4 text-center">
      <div className="flex items-center gap-2 text-foreground">
        <Icon className="size-4.5" />
        <span className="font-display text-lg tracking-[0.01em]">{name}</span>
      </div>
      {connecting ? (
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          {/* The global reduced-motion policy zeroes this keyframe animation,
            * leaving a static arc while the text still conveys the state. */}
          <span
            className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
            aria-hidden="true"
          />
          Connecting to {agentShortName}…
        </p>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">
          {libraryScoped
            ? 'Ask across your library — every folder you have added is in scope.'
            : 'Ask about this folder — your files are the context.'}
        </p>
      )}
    </div>
  );
}

export function StarterTemplates({ onPrefill, libraryScoped }: {
  onPrefill: (text: string) => void;
  libraryScoped?: boolean;
}) {
  const starters = libraryScoped ? LIBRARY_STARTERS : FOLDER_STARTERS;
  return (
    <div className="flex flex-col pt-5">
      {starters.map((starter) => (
        <Button
          key={starter.title}
          // Preflight is intentionally off in this renderer (styles.css), so
          // native button chrome must be reset here: zero all borders and the
          // UA background, then re-add only the top hairline separator.
          className="group flex cursor-pointer items-center gap-3 rounded-lg border-0 border-t border-solid border-border bg-transparent px-2.5 py-3 text-left outline-none first:border-t-0 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          onPress={() => onPrefill(starter.text)}
        >
          <starter.Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
            <span className="shrink-0 text-sm font-medium text-foreground">{starter.title}</span>
            <span className="truncate text-sm text-muted-foreground">{starter.description}</span>
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 -rotate-90 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </Button>
      ))}
    </div>
  );
}

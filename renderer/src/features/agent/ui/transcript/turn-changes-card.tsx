/** What one Agent turn changed in the folder's Markdown, as a quiet list
 *  under the turn: each file once, with its line counts and the one thing
 *  the reader can do with it. Nothing opens on its own; Review is the reader
 *  choosing to see the turn's changes inside the document. */
import { FileDiff } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { fileBasename } from '@/features/agent/domain/file-change';
import type { AgentTurnChangedFile } from '@/features/agent/domain/session';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';
import type { SourceReference } from '@/shared/domain/source-reference';

import { Counts } from './file-change';

/** The reader asking to review one file a turn changed. */
export interface AgentTurnChangeReview {
  readonly source: SourceReference;
  readonly turnId: string;
}

const CHANGE_LABEL: Record<AgentTurnChangedFile['change'], string> = {
  created: 'Created',
  deleted: 'Deleted',
  edited: 'Edited',
};

function FileAction({
  file,
  name,
  onOpenSource,
  onReview,
  source,
}: {
  file: AgentTurnChangedFile;
  name: string;
  onOpenSource?: ((source: SourceReference, phrase: string | null) => void) | undefined;
  onReview?: ((source: SourceReference) => void) | undefined;
  source: SourceReference | null;
}) {
  if (!source || file.change === 'deleted') return null;
  // A created file has no earlier text to compare against, so the whole file
  // is the change and opening it is the review.
  if (file.change === 'created') {
    return onOpenSource ? (
      <Button
        aria-label={`Open ${name}`}
        className="-mr-2.5"
        onClick={() => onOpenSource(source, null)}
        size="compact"
        variant="ghost"
      >
        Open
      </Button>
    ) : null;
  }
  return onReview ? (
    <Button
      aria-label={`Review changes to ${name}`}
      className="-mr-2.5"
      onClick={() => onReview(source)}
      size="compact"
      variant="ghost"
    >
      Review
    </Button>
  ) : null;
}

export function AgentTurnChangesCard({
  files,
  onOpenSource,
  onReviewTurnChange,
  sourceFor,
  turnId,
}: {
  files: readonly AgentTurnChangedFile[];
  onOpenSource?: ((source: SourceReference, phrase: string | null) => void) | undefined;
  onReviewTurnChange?: ((review: AgentTurnChangeReview) => void) | undefined;
  sourceFor?: ((path: string) => SourceReference | null) | undefined;
  turnId: string;
}) {
  const shape = useShape();
  const headingId = useId();
  const onReview = onReviewTurnChange
    ? (source: SourceReference) => onReviewTurnChange({ source, turnId })
    : undefined;
  return (
    <section
      aria-labelledby={headingId}
      className={cn('border border-border bg-surface-2 px-3 pt-2.5 pb-1', shape.panel)}
    >
      <h3
        className="flex items-center gap-2 pb-1 text-[12px] font-medium text-muted-foreground"
        id={headingId}
      >
        <FileDiff aria-hidden className="size-3.5 shrink-0" strokeWidth={1.5} />
        Changed in this turn
      </h3>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {files.map((file) => {
          const name = fileBasename(file.path);
          const source = sourceFor?.(file.path) ?? null;
          const shown = source?.path ?? file.path;
          const directory = shown.slice(0, shown.length - name.length).replace(/[\\/]$/u, '');
          return (
            <li
              className={cn('flex min-h-7 items-center gap-2 text-[12px]', shape.item)}
              key={file.path}
            >
              <FileTypeIcon
                aria-hidden="true"
                className="shrink-0 text-muted-foreground"
                path={file.path}
                size={14}
              />
              <span className="shrink-0 font-medium text-foreground" title={file.path}>
                {name}
              </span>
              {directory && (
                <span className="min-w-0 truncate text-muted-foreground" title={file.path}>
                  {directory}
                </span>
              )}
              <Counts additions={file.additions} deletions={file.deletions} />
              <span
                className={cn(
                  'shrink-0 text-muted-foreground',
                  file.additions === 0 && file.deletions === 0 && 'ml-auto',
                )}
              >
                {CHANGE_LABEL[file.change]}
              </span>
              <FileAction
                file={file}
                name={name}
                onOpenSource={onOpenSource}
                onReview={onReview}
                source={source}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

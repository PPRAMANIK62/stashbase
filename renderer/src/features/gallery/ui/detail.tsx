/** One Gallery entry's page, and the section frame its spec sheet is built
 *  from. The reasoning behind the order of the page sits on the component. */
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { galleryContents, type GalleryEntry } from '@/features/gallery/domain/entry';
import { cn } from '@/lib/utils';

import { GalleryFileTree } from './file-tree';
import { GalleryScreenshots } from './screenshots';

/** A section of the spec sheet: one quiet label over one artifact. */
function Section({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-2', className)}>
      <h4 className="m-0 text-caption font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h4>
      {children}
    </section>
  );
}

/**
 * One entry's product page, read top to bottom: what it looks like, what it
 * is, what is in it and how it was made, then the one action.
 *
 * A spec sheet rather than a workspace. The screenshot leads because what a
 * wiki looks like is the reason to want one, and the two artifacts nobody
 * else's shop can show — the copy's real file tree and the request that
 * produced it — stand side by side rather than behind tabs. Neither is long
 * enough to be worth a click.
 *
 * One geometry across every state: an unpublished field states itself in the
 * slot it would have filled and never reshapes the page.
 *
 * **Copy prompt** is the only thing the Gallery does with composer text. It
 * never places or sends any, so the request travels through the clipboard and
 * the reader decides where it lands.
 *
 * A page inside the shop rather than a second modal over it: one dismiss
 * target for one decision, and Back is the honest way home.
 */
export function GalleryEntryPage({
  copying,
  entry,
  issue,
  onBack,
  onCopy,
}: {
  copying: boolean;
  entry: GalleryEntry;
  issue: string | null;
  onBack(): void;
  onCopy(entry: GalleryEntry): void;
}) {
  const [copied, setCopied] = useState(false);
  const contents = galleryContents(entry);

  useEffect(() => setCopied(false), [entry.id]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1_600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 shrink-0">
        <Button leadingIcon={ArrowLeft} onClick={onBack} size="compact" variant="ghost">
          All Wikis
        </Button>
      </div>

      {/* Wide, the text reads down one fixed column and the images take the
       * rest, so the left edge stays put from one entry to the next. Narrow,
       * the same blocks stack with the screenshot first — what a wiki looks
       * like is the reason to want one, and it should not be below the fold.
       * The screenshots come first in the source for exactly that. */}
      <div
        className={cn(
          'grid min-h-0 flex-1 gap-8 overflow-y-auto',
          '@2xl:grid-cols-[22rem_minmax(0,1fr)] @2xl:overflow-hidden',
        )}
      >
        {/* `min-h-0` on both columns, or a grid item's automatic minimum
         * keeps the row as tall as its content and a long build prompt walks
         * straight out of the dialog. */}
        <div className="min-h-0 min-w-0 @2xl:col-start-2 @2xl:row-start-1">
          <GalleryScreenshots name={entry.name} screenshots={entry.screenshots ?? []} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-5 @2xl:col-start-1 @2xl:row-start-1 @2xl:overflow-y-auto">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="m-0 text-title font-semibold tracking-tight text-foreground">
                {entry.name}
              </h3>
              {/* The same badge the card carried, so the shelf and the page
               * agree about what this is. */}
              <Badge color="gray" size="compact">
                {entry.category}
              </Badge>
            </div>
            <p className="m-0 mt-1.5 text-caption leading-relaxed text-muted-foreground">
              {entry.description}
            </p>
          </div>

          {/* Both artifacts stand at once. Neither is long enough to be worth
           * a click, and the request is what teaches a reader what to ask
           * for on a folder of their own. */}
          <Section label="What's inside">
            {contents.kind === 'files' ? (
              <GalleryFileTree paths={contents.files} />
            ) : (
              <p className="m-0 text-caption leading-relaxed text-muted-foreground">
                {contents.line}
              </p>
            )}
          </Section>

          {/* The prompt is the one thing here with no natural length, so it
           * is the one thing that scrolls. Giving the column the scrollbar
           * instead would hide the file tree and the label behind it. */}
          <Section className="min-h-0 flex-1" label="How it's built">
            <p
              className={cn(
                'm-0 min-h-32 flex-1 overflow-y-auto rounded-md border border-border bg-surface-3 p-3 text-caption leading-relaxed whitespace-pre-wrap',
                entry.wikiPrompt ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {entry.wikiPrompt ?? 'The build prompt for this Wiki isn’t published yet.'}
            </p>
            <div className="shrink-0">
              <Button
                disabled={!entry.wikiPrompt}
                leadingIcon={copied ? Check : Copy}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(entry.wikiPrompt ?? '')
                    .then(() => setCopied(true));
                }}
                size="compact"
                variant="secondary"
              >
                {copied ? 'Copied' : 'Copy prompt'}
              </Button>
            </div>
          </Section>
        </div>
      </div>

      {/* The page's conclusion, on its own rule beneath everything that argues
       * for it. No ellipsis: nothing further to answer — the copy lands in
       * the folder home and opens itself, which the note beside the button
       * says, since a second window is the one surprise the click holds. */}
      <div className="mt-4 flex shrink-0 items-center justify-between gap-4 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="m-0 min-w-0 text-caption text-destructive" role="alert">
            {issue}
          </p>
          {issue === null && (
            <p className="m-0 text-caption text-muted-foreground">
              Saved as a folder of your own and opened in a new window.
            </p>
          )}
        </div>
        <Button
          className="shrink-0"
          loading={copying}
          onClick={() => onCopy(entry)}
          variant="primary"
        >
          Make a copy
        </Button>
      </div>
    </div>
  );
}

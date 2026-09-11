/** One Gallery entry's page, and the section frame its spec sheet is built
 *  from. The reasoning behind the order of the page sits on the component. */
import { Collapsible } from '@base-ui/react/collapsible';
import { ArrowLeft, Check, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { GalleryEntry } from '@/features/gallery/domain/entry';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';

import { GalleryScreenshots } from './screenshots';

/** Plain text into paragraphs: a blank line is the one separator the index
 *  promises, and a stray run of them is not a third paragraph. Each carries a
 *  key of its own text, numbered on repeat, so a list of them needs no index. */
function paragraphs(text: string): { key: string; text: string }[] {
  const seen = new Map<string, number>();
  return text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => {
      const repeat = seen.get(paragraph) ?? 0;
      seen.set(paragraph, repeat + 1);
      return { key: repeat === 0 ? paragraph : `${paragraph}#${repeat}`, text: paragraph };
    });
}

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
 * is, the publisher's own introduction, then the one action — with the
 * instructions its Agent works to folded beneath the introduction.
 *
 * A spec sheet rather than a workspace. The screenshot leads because what a
 * wiki looks like is the reason to want one. About is the publisher talking:
 * why the wiki was made, what it holds, who it is for — prose, because a
 * listing is inventory, and inventory does not say whether the copy is worth
 * taking. Agent Instructions is the request the wiki was built with, shown
 * whole: it is what the copy's Agent will keep working to, and the recipe
 * for a folder of one's own. It is folded rather than tabbed because the
 * two are not peers: most readers never need the recipe, and a tab strip
 * would rank it beside the introduction. Folded, it is one press away and
 * otherwise out of the way, and it closes again with the next entry.
 *
 * One geometry across every state: an unpublished field states itself in the
 * slot it would have filled and never reshapes the page.
 *
 * **Copy**, a glyph on the instructions box, is the only thing the Gallery does
 * with composer text. It never places or sends any, so the text travels through the
 * clipboard and the reader decides where it lands.
 *
 * A page inside the shop rather than a second modal over it: one dismiss
 * target for one decision. The way back stands at the left of the action
 * row, where a sheet keeps its retreat beside its commit, and it names its
 * destination rather than a direction: a welcome-band card lands here
 * directly, so for that reader the shelf is not "back" but a place not yet
 * seen.
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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const instructionsPanelId = useId();

  useEffect(() => {
    setCopied(false);
    setInstructionsOpen(false);
  }, [entry.id]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1_600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Wide, the images keep a 16:9 frame in a column capped at the width
       * that frame needs, and the text takes the rest: the prompt and the
       * file list are what a reader weighs, and a screenshot stretched to
       * fill a wide window was a banner, not a preview. The text column
       * never drops below the width it reads well at. Narrow, the same
       * blocks stack with the screenshot first — what a wiki looks like is
       * the reason to want one, and it should not be below the fold. The
       * screenshots come first in the source for exactly that. */}
      <div
        className={cn(
          'grid min-h-0 flex-1 gap-8 overflow-y-auto',
          '@2xl:grid-cols-[minmax(22rem,1fr)_minmax(0,39rem)] @2xl:overflow-hidden',
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
            <p className="m-0 mt-1.5 text-body leading-relaxed text-muted-foreground">
              {entry.description}
            </p>
          </div>

          {/* Reading sizes, not control sizes: the description and the
           * instructions read at body, and the introduction one step above
           * it, because this column is prose a reader weighs rather than a
           * form they scan. The labels stay at caption, as labels do. */}
          <Section label="About">
            {entry.about ? (
              <div className="flex flex-col gap-2">
                {paragraphs(entry.about).map((paragraph) => (
                  <p
                    className="m-0 text-subtitle leading-relaxed text-foreground"
                    key={paragraph.key}
                  >
                    {paragraph.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="m-0 text-body leading-relaxed text-muted-foreground">
                The introduction for this Wiki isn’t published yet.
              </p>
            )}
          </Section>

          {/* The folded row wears the same label as the sections above it, in
           * the same grey open or closed, so it reads as one more heading
           * with its body put away rather than as a control: the chevron
           * alone says which state it is in. It trails so the label keeps
           * the column's left edge. Open, the box is capped and scrolls inside itself, so
           * a long request never pushes the page's conclusion out of reach.
           * Copy is a glyph in the box's corner, where every code block on
           * the web keeps it: a reader who has unfolded the recipe knows what
           * the glyph takes without a word beside it. */}
          <Collapsible.Root onOpenChange={setInstructionsOpen} open={instructionsOpen}>
            <Collapsible.Trigger
              render={
                <button
                  aria-controls={instructionsPanelId}
                  className={focusRing(
                    '-mx-1 flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-caption font-medium tracking-wide text-muted-foreground uppercase transition-colors duration-fast outline-none hover:text-foreground',
                  )}
                  type="button"
                >
                  <span>Agent Instructions</span>
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      'size-3.5 shrink-0 transition-transform duration-fast motion-reduce:transition-none',
                      instructionsOpen && 'rotate-90',
                    )}
                  />
                </button>
              }
            />
            <Collapsible.Panel className="pt-2" id={instructionsPanelId}>
              {/* The text is the scroller and the glyph sits over the frame,
               * outside it, so it stays in the corner while the text moves.
               * The text keeps clear of that corner with its own padding. */}
              <div className="relative rounded-md border border-border bg-surface-3">
                <p
                  className={cn(
                    'm-0 max-h-72 overflow-y-auto p-3 pr-10 text-body leading-relaxed whitespace-pre-wrap',
                    entry.wikiPrompt ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {entry.wikiPrompt ?? 'The Agent Instructions for this Wiki aren’t published yet.'}
                </p>
                {entry.wikiPrompt && (
                  <Tooltip content={copied ? 'Copied' : 'Copy'} side="bottom">
                    <Button
                      aria-label={copied ? 'Copied' : 'Copy'}
                      className="absolute top-1.5 right-1.5"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(entry.wikiPrompt ?? '')
                          .then(() => setCopied(true));
                      }}
                      size="icon-compact"
                      variant="ghost"
                    >
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </Button>
                  </Tooltip>
                )}
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        </div>
      </div>

      {/* The page's conclusion, on its own rule beneath everything that argues
       * for it: the retreat at the left, the commit at the right, the way a
       * sheet ends. No ellipsis on the commit: nothing further to answer —
       * the copy lands in the folder home and opens itself in a window of
       * its own, which the window explains the moment it opens. A failure
       * reports beside the retreat; at rest that slot holds nothing. The
       * negative margin lands the retreat's label on the content edge. */}
      <div className="mt-4 flex shrink-0 items-center justify-between gap-4 border-t border-border pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            className="-ml-3 shrink-0"
            leadingIcon={ArrowLeft}
            onClick={onBack}
            size="compact"
            variant="ghost"
          >
            Gallery home
          </Button>
          <p className="m-0 min-w-0 text-caption text-destructive" role="alert">
            {issue}
          </p>
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

/** One Gallery entry's page, and the section frame its spec sheet is built
 *  from. The reasoning behind the order of the page sits on the component. */
import { ArrowLeft } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GalleryEntry } from '@/features/gallery/domain/entry';
import { cn } from '@/lib/utils';

import { GalleryPrompt } from './prompt';
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

/** Details describe the project and its generating prompt. Local acquisition
 * and window allocation belong to the shared project-entry flow. */
export function GalleryEntryPage({
  copying,
  entry,
  onBack,
  onCopy,
}: {
  copying: boolean;
  entry: GalleryEntry;
  onBack(): void;
  onCopy(entry: GalleryEntry): void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Wide, the images keep a 16:9 frame in a column capped at the width
       * that frame needs, and the text takes the rest: the prompt and the
       * file list are what a reader weighs, and a screenshot stretched to
       * fill a wide window was a banner, not a preview. The text column
       * never drops below the width it reads well at. Narrow, the same
       * blocks stack with the screenshot first — what a project looks like is
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

        {/* The prose column is one scroller for everything a reader weighs,
         * introduction and request together, and it says so at its edge: the
         * fade is scroll-aware, so a column with nothing below it stays crisp
         * and a column with more dissolves into the action row rather than
         * ending on a cut. Without it a folded request sat below the fold
         * with nothing to suggest it was there. */}
        <div className="scroll-fade flex min-h-0 min-w-0 flex-col gap-5 [--scroll-fade-size:1.25rem] @2xl:col-start-1 @2xl:row-start-1 @2xl:overflow-y-auto">
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
                The introduction for this project isn’t published yet.
              </p>
            )}
          </Section>

          <GalleryPrompt key={entry.wikiPrompt} prompt={entry.wikiPrompt} />
        </div>
      </div>

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

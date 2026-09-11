import { Badge } from '@/components/ui/badge';
import type { GalleryEntry } from '@/features/gallery/domain/entry';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';

/**
 * One ready-made Wiki on the shelf.
 *
 * The whole card is the affordance rather than a title link with a button
 * beside it: every card does exactly one thing, which is open its entry page,
 * and a second target inside it would only invite a copy nobody has read about
 * yet. Taking a copy is a decision the entry page asks for.
 *
 * A shelf is scanned, so at rest each card shows the picture and its name and
 * nothing else — a wall of paragraphs is a list, not a shelf. The description
 * is one pointer or one Tab away, and it grows over the picture rather than
 * below it: a card that changed height on hover would shuffle every card after
 * it across the grid.
 */
export function GalleryCard({
  entry,
  onOpen,
}: {
  entry: GalleryEntry;
  onOpen(entry: GalleryEntry): void;
}) {
  const hero = entry.screenshots?.[0] ?? null;
  return (
    <button
      className={cn(
        'group relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-surface-2 text-left shadow-surface-2 transition-colors duration-fast outline-none hover:border-foreground/25',
        focusRing(),
      )}
      onClick={() => onOpen(entry)}
      type="button"
    >
      {hero && (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover object-top transition-transform duration-slow group-hover:scale-[1.03] motion-reduce:transition-none"
          loading="lazy"
          src={hero}
        />
      )}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-surface-3 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-body font-medium text-foreground">
            {entry.name}
          </span>
          <Badge color="gray" size="compact">
            {entry.category}
          </Badge>
        </span>
        {/* Rows from nothing to content: the one way to animate a height CSS
         * has never been told. Focus opens it too, so the description is not
         * pointer-only. */}
        <span
          className={cn(
            'grid grid-rows-[0fr] transition-[grid-template-rows] duration-base',
            'group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]',
            'motion-reduce:transition-none',
          )}
        >
          <span className="overflow-hidden">
            <span className="line-clamp-2 block text-caption text-muted-foreground">
              {entry.description}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';

/** The hero keeps a landscape frame but stops growing on a wide window: a
 *  screenshot tall enough to push the rest of the page below the fold has
 *  stopped being an introduction. */
const HERO_FRAME = { aspectRatio: '16 / 10', maxHeight: '22rem' } as const;

/**
 * The curated screenshots: one hero across the page's full width, and a strip
 * of thumbnails beneath it.
 *
 * One geometry across every state. The hero keeps its frame and the strip
 * keeps its row whether an entry published ten shots, one, or none, so an
 * entry that has published nothing empties a slot rather than reshaping the
 * page — which is also what a reader sees offline, since these bytes cross the
 * daemon's proxy exactly as the index does.
 */
export function GalleryScreenshots({
  name,
  screenshots,
}: {
  name: string;
  screenshots: readonly string[];
}) {
  const [shot, setShot] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  // Which sides still have content, read from real scroll geometry rather than
  // counted: the strip is a native scroller and the trackpad moves it too.
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateArrows = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    setCanScroll({
      left: strip.scrollLeft > 4,
      right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    setShot(0);
    updateArrows();
  }, [name, screenshots.length, updateArrows]);

  /** One thumbnail plus its gap. The native scroller supplies the easing; the
   *  arrow only picks the destination. */
  const nudge = (direction: 1 | -1) => {
    stripRef.current?.scrollBy({ behavior: 'smooth', left: direction * 208 });
  };

  const hero = screenshots[shot];

  return (
    <div className="min-w-0">
      {hero ? (
        <div
          className="relative w-full overflow-hidden rounded-xl border border-border bg-surface-3"
          style={HERO_FRAME}
        >
          <img
            alt={`${name} screenshot ${shot + 1}`}
            className="absolute inset-0 size-full object-cover object-top"
            src={hero}
          />
        </div>
      ) : (
        <div
          className="flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-3"
          style={HERO_FRAME}
        >
          <p className="m-0 max-w-xs text-center text-caption text-muted-foreground">
            Screenshots for this Wiki aren’t published yet.
          </p>
        </div>
      )}

      {screenshots.length > 1 && (
        <div className="relative mt-2">
          <div
            className="flex snap-x gap-2 overflow-x-auto [scrollbar-width:none]"
            onScroll={updateArrows}
            ref={stripRef}
          >
            {screenshots.map((url, index) => (
              <button
                aria-current={index === shot || undefined}
                aria-label={`Screenshot ${index + 1}`}
                className={focusRing(
                  cn(
                    'block w-24 shrink-0 snap-start cursor-pointer overflow-hidden rounded-md border bg-surface-3 p-0 transition-colors duration-fast outline-none',
                    // Selected reads as ink, not accent: the accent is reserved
                    // for the page's one action, and these repeat.
                    index === shot
                      ? 'border-foreground'
                      : 'border-border hover:border-foreground/40',
                  ),
                )}
                key={url}
                onClick={() => setShot(index)}
                type="button"
              >
                <img
                  alt=""
                  className="block aspect-[16/10] w-full object-cover object-top"
                  src={url}
                />
              </button>
            ))}
          </div>
          {canScroll.left && (
            <Button
              aria-label="Previous screenshots"
              className="absolute top-1/2 -left-3 -translate-y-1/2 rounded-full shadow-surface-3"
              onClick={() => nudge(-1)}
              size="icon-compact"
              variant="secondary"
            >
              <ChevronLeft />
            </Button>
          )}
          {canScroll.right && (
            <Button
              aria-label="More screenshots"
              className="absolute top-1/2 -right-3 -translate-y-1/2 rounded-full shadow-surface-3"
              onClick={() => nudge(1)}
              size="icon-compact"
              variant="secondary"
            >
              <ChevronRight />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

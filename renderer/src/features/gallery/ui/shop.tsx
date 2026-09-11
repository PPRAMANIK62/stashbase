import type { GalleryEntry } from '@/features/gallery/domain/entry';

import { GalleryCard } from './card';

/**
 * The shelf itself, in whichever frame is holding it.
 *
 * The band and the overlay are the same shop at two widths, so the grid is
 * container-driven rather than viewport-driven: a docked band and a
 * near-fullscreen overlay ask the same component for different columns without
 * either knowing about the other.
 */
export function GalleryShop({
  entries,
  onOpen,
}: {
  entries: readonly GalleryEntry[];
  onOpen(entry: GalleryEntry): void;
}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-6 @xs:grid-cols-2 @md:grid-cols-3 @5xl:grid-cols-4">
        {entries.map((entry) => (
          <GalleryCard entry={entry} key={entry.id} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

import type { GalleryEntry } from '@/features/gallery/domain/entry';

import { GalleryCard } from './card';
import { GalleryIndexRecovery, type GalleryRecovery } from './index-recovery';

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
  recovery = null,
}: {
  entries: readonly GalleryEntry[];
  onOpen(entry: GalleryEntry): void;
  recovery?: GalleryRecovery | null;
}) {
  return (
    <div className="@container">
      <GalleryIndexRecovery recovery={recovery} />
      <div className="grid grid-cols-1 gap-6 @xs:grid-cols-2 @md:grid-cols-3 @5xl:grid-cols-4">
        {entries.map((entry) => (
          <GalleryCard entry={entry} key={entry.id} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

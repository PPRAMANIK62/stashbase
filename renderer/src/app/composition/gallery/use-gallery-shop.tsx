import { useCallback, useState, type ReactNode } from 'react';

import {
  GalleryOverlay,
  GalleryShop,
  useGallery,
  useGalleryCopy,
  type GalleryEntry,
  type GalleryPort,
} from '@/features/gallery/public';

export interface GalleryShopCommand {
  /** The shelf on its own, for a surface that holds the shop inline rather
   *  than opening it over what is already there. */
  band: ReactNode;
  /** Puts the shop on screen. The window keeps whatever it was showing. */
  browse(): void;
  /** The shop and the entry page it opens, rendered by the shell. */
  surfaces: ReactNode;
}

/**
 * The one shop this window can open, and everything it needs to run.
 *
 * Two entrances reach this same command. The bare window derives the band on
 * its welcome screen, and a folder window offers a sidebar row. One shop means
 * one index and one copy in flight rather than a second shop per surface. A
 * band card opens that entry's page directly, where the sidebar row opens the
 * shelf.
 *
 * A copy opens in a window of its own and the shop stays put, which is why
 * neither the overlay nor the entry page closes when a copy succeeds: the
 * reader is still in the shop, looking at the next entry.
 */
export function useGalleryShop(port: GalleryPort): GalleryShopCommand {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<GalleryEntry | null>(null);
  const gallery = useGallery(port);
  const copying = useGalleryCopy(port);

  return {
    band: (
      <GalleryShop
        entries={gallery.entries}
        onOpen={(next) => {
          setEntry(next);
          setOpen(true);
        }}
      />
    ),
    browse: useCallback(() => setOpen(true), []),
    surfaces: (
      <GalleryOverlay
        copying={copying.copyingId === entry?.id}
        entries={gallery.entries}
        entry={entry}
        issue={copying.issue}
        onBack={() => setEntry(null)}
        onClose={() => {
          setOpen(false);
          // Closing the shop ends the visit: reopening starts at the shelf
          // rather than on whichever entry was last read.
          setEntry(null);
        }}
        onCopy={copying.copy}
        onOpen={setEntry}
        open={open}
      />
    ),
  };
}

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import {
  GalleryOverlay,
  GalleryShop,
  useGallery,
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
 */
export function useGalleryShop(
  port: GalleryPort,
  copy: (entry: GalleryEntry) => void,
  pending: boolean,
  activePath: string | null,
): GalleryShopCommand {
  const [open, setOpen] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);
  const gallery = useGallery(port);
  const entry = gallery.entries.find((candidate) => candidate.id === entryId) ?? null;
  useEffect(() => {
    if (activePath) {
      setOpen(false);
      setEntryId(null);
    }
  }, [activePath]);

  return {
    band: (
      <GalleryShop
        entries={gallery.entries}
        recovery={gallery.recovery}
        onOpen={(next) => {
          setEntryId(next.id);
          setOpen(true);
          gallery.recovery?.retry();
        }}
      />
    ),
    browse: useCallback(() => {
      setOpen(true);
      gallery.recovery?.retry();
    }, [gallery.recovery]),
    surfaces: (
      <GalleryOverlay
        copying={pending}
        entries={gallery.entries}
        entry={entry}
        recovery={gallery.recovery}
        unavailable={entryId !== null && entry === null}
        onBack={() => setEntryId(null)}
        onClose={() => {
          setOpen(false);
          // Closing the shop ends the visit: reopening starts at the shelf
          // rather than on whichever entry was last read.
          setEntryId(null);
        }}
        onCopy={copy}
        onOpen={(next) => setEntryId(next.id)}
        open={open}
      />
    ),
  };
}

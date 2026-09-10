import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GalleryEntry } from '@/features/gallery/domain/entry';

import { GalleryEntryPage } from './detail';
import { GalleryShop } from './shop';

/**
 * The shop, and the entry page it opens inside itself.
 *
 * An overlay rather than a route: the window keeps the folder it was showing,
 * and closing puts the reader back exactly where they were. That is also why a
 * copy opens in a NEW window — this one is the shop the reader returns to for
 * the next entry, which is why nothing here closes when a copy succeeds.
 *
 * The entry page replaces the shelf rather than stacking a second modal over
 * it: one dismiss target for one decision, and Back is the honest way home.
 */
export function GalleryOverlay({
  copying,
  entries,
  entry,
  issue,
  onBack,
  onClose,
  onCopy,
  onOpen,
  open,
}: {
  copying: boolean;
  entries: readonly GalleryEntry[];
  entry: GalleryEntry | null;
  issue: string | null;
  onBack(): void;
  onClose(): void;
  onCopy(entry: GalleryEntry): void;
  onOpen(entry: GalleryEntry): void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      {/* A shop, not a question: it takes the window the way a page does,
        * capped so a wide display does not stretch a shelf into a horizon.
        * One steady frame across both views, because the reader navigates
        * inside it and a dialog that resizes under a click reads as a jump. */}
      {/* A column, explicitly: the dialog primitive is a block, so without
        * this the header and the page below it simply stack and a long entry
        * walks out of the frame instead of scrolling inside it. */}
      <DialogContent
        className="@container flex h-[min(86vh,46rem)] max-w-[min(94vw,80rem)] flex-col"
        width="wide"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Gallery</DialogTitle>
          <DialogDescription>
            Ready-made Wikis, each a real folder with a wiki built from it. A copy opens in its own
            window.
          </DialogDescription>
        </DialogHeader>
        {entry ? (
          <GalleryEntryPage
            copying={copying}
            entry={entry}
            issue={issue}
            onBack={onBack}
            onCopy={onCopy}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GalleryShop entries={entries} onOpen={onOpen} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

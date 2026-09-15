import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GalleryEntry } from '@/features/gallery/domain/entry';
import { FailureLine } from '@/shared/ui/failure-notice';

import { GalleryEntryPage } from './detail';
import { GalleryIndexRecovery, type GalleryRecovery } from './index-recovery';
import { GalleryShop } from './shop';

/**
 * The shop, and the entry page it opens inside itself.
 *
 * An overlay rather than a route: the window keeps the folder it was showing,
 * and closing puts the reader back exactly where they were. Copying uses the
 * shared project-entry flow, which decides whether to reuse or open a window.
 *
 * The entry page replaces the shelf rather than stacking a second modal over
 * it: one dismiss target for one decision, and one way home, which the page
 * draws on its own action row so this header reads the same over the shelf
 * and over a page.
 */
export function GalleryOverlay({
  copying,
  entries,
  entry,
  recovery = null,
  unavailable = false,
  onBack,
  onClose,
  onCopy,
  onOpen,
  open,
}: {
  copying: boolean;
  entries: readonly GalleryEntry[];
  entry: GalleryEntry | null;
  recovery?: GalleryRecovery | null;
  unavailable?: boolean;
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
            Explore how people organize files and write with Agents. Find ideas for your own.
          </DialogDescription>
        </DialogHeader>
        <GalleryIndexRecovery recovery={recovery} />
        {unavailable && (
          <FailureLine tone="capability">
            This project is no longer in the Gallery. Choose another project below.
          </FailureLine>
        )}
        {entry ? (
          <GalleryEntryPage
            key={entry.id}
            copying={copying}
            entry={entry}
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

import { lazy, Suspense } from 'react';

const ClipboardImportDialog = lazy(() => import('./ClipboardImportDialog'));

export interface ClipboardOffer {
  dataUrl: string;
  mime: string;
  width: number;
  height: number;
  hash: string;
  filename: string;
}

/**
 * Asks whether to import an image found on the clipboard (e.g. a
 * screenshot the user just copied, then switched back to StashBase).
 * Shown only in the Electron app — `main.cjs` pushes the offer on window
 * focus and the renderer mounts this. A thumbnail makes the source
 * obvious; Add runs the same upload path as drag-in / capture (so the
 * image gets OCR'd into a hidden note), Dismiss leaves it alone.
 *
 * Modal (not a toast) by product decision — a screenshot is a
 * deliberate "I want to keep this" moment worth a clear yes/no. The Base UI
 * dialog owns Esc and backdrop dismissal; Enter adds.
 */
export function ClipboardImportModal({
  offer,
  onAdd,
  onClose,
}: {
  offer: ClipboardOffer;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Suspense fallback={<div className="modal-load-status" role="status" aria-live="polite">Opening image import…</div>}>
      <ClipboardImportDialog
        title="Add image to StashBase?"
        description={<>There's an image on your clipboard. Add it to this folder — its text gets extracted so you can search it later.</>}
        onCancel={onClose}
        onAdd={onAdd}
      >
        <div className="clipboard-offer-preview">
          <img src={offer.dataUrl} alt="Clipboard image" />
        </div>
      </ClipboardImportDialog>
    </Suspense>
  );
}

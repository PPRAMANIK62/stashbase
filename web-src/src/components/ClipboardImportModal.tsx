import { Suspense } from 'react';
import { lazyWithRetry } from './ErrorBoundary';
import { useOverlayLayer } from './OverlayStack';
import { ModalLoadingStatus } from './ui/status';

const ManagedClipboardImport = lazyWithRetry(() => import('./ManagedClipboardImport'));

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
  const layer = useOverlayLayer(true);
  return (
    <Suspense
      fallback={(
        <ModalLoadingStatus
          label="Opening image import…"
          isTopmost={layer.isTopmost}
          onCancel={onClose}
          closeOnBackdrop
        />
      )}
    >
      <ManagedClipboardImport
        title="Add image to StashBase?"
        description={<>There's an image on your clipboard. Add it to this folder — its text gets extracted so you can search it later.</>}
        isTopmost={layer.isTopmost}
        onCancel={onClose}
        onAdd={onAdd}
      >
        <div className="clipboard-offer-preview">
          <img src={offer.dataUrl} alt="Clipboard image" />
        </div>
      </ManagedClipboardImport>
    </Suspense>
  );
}

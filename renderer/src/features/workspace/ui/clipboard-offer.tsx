import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { filesFailure } from '@/features/workspace/application/failure-messages';
import type {
  ClipboardCapturePort,
  ClipboardImageOffer,
  UploadPort,
} from '@/features/workspace/application/ports';
import { useRequestSignals } from '@/lib/runtime/use-request-signals';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface ClipboardOfferProps {
  activeFolderPath: string | null;
  /** The desktop clipboard watch, or null where there is none. */
  capture: ClipboardCapturePort | null;
  onImported?: ((source: SourceReference) => void) | undefined;
  upload: UploadPort;
}

/**
 * The offer to keep an image the reader copied.
 *
 * Nothing here decodes or classifies the clipboard: the capture port only ever
 * hands over an image this window could actually import, so the dialog's only
 * decisions are whether a folder is open to import into and what a refused
 * import says — and that sentence comes from the files ladder like every other
 * refusal in this feature.
 */
export function ClipboardOffer({
  activeFolderPath,
  capture,
  onImported,
  upload,
}: ClipboardOfferProps) {
  const [offer, setOffer] = useState<ClipboardImageOffer | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // One lane: a second Add replaces the import already in flight, and
  // unmounting drops it.
  const signalFor = useRequestSignals<'import'>();

  useEffect(() => {
    if (!capture) return;
    capture.refresh();
    return capture.subscribe((image) => {
      setFailure(null);
      setOffer(image);
    });
  }, [capture]);

  const dismiss = useCallback(() => {
    if (!offer || pending) return;
    capture?.settle(offer.id);
    setOffer(null);
    setFailure(null);
  }, [capture, offer, pending]);

  const add = useCallback(async () => {
    if (!offer || !activeFolderPath || pending) return;
    const signal = signalFor('import');
    setPending(true);
    setFailure(null);
    try {
      const [path] = await upload.upload(
        activeFolderPath,
        [{ blob: offer.bytes, name: offer.name }],
        signal,
      );
      capture?.settle(offer.id);
      setOffer(null);
      if (path !== undefined) onImported?.({ folderPath: activeFolderPath, path });
    } catch (error) {
      // The reader pressed Add a moment ago, so the dialog answers in one
      // voice whatever refused: the tone would only repeat what the dialog's
      // own framing already says.
      if (!signal.aborted) setFailure(filesFailure(error).message);
    } finally {
      if (!signal.aborted) setPending(false);
    }
  }, [activeFolderPath, capture, offer, onImported, pending, signalFor, upload]);

  return (
    <ConfirmDialog
      cancelLabel="Dismiss"
      confirmLabel="Add"
      description={
        <>
          There&rsquo;s an image on your clipboard. Add it to this folder &mdash; its text gets
          extracted so you can search it later.
        </>
      }
      failure={failure}
      onCancel={dismiss}
      onConfirm={() => void add()}
      open={offer !== null && activeFolderPath !== null}
      pending={pending}
      title="Add image to StashBase?"
    />
  );
}

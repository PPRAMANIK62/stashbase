import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UploadApi } from '@/features/workspace/public';
import type { CaptureBridge } from '@/platform/electron/capture';
import type { CaptureImageAvailable } from '@/protocols/electron/capture';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface ClipboardOfferProps {
  activeFolderPath: string | null;
  bridge: CaptureBridge | null;
  onImported?: (source: SourceReference) => void;
  uploadApi: UploadApi;
}

/** CSP forbids `fetch(data:)`, so the base64 body is decoded by hand. */
export function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/su.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || fallbackMime;
  const payload = match[3] ?? '';
  try {
    if (match[2]) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1)
        bytes[index] = binary.charCodeAt(index);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
}

/** Forwards Agent composer focus so a paste there is never raced by an offer. */
export function useComposerFocusSignal(bridge: CaptureBridge | null, focused: boolean): void {
  useEffect(() => {
    bridge?.setComposerFocused(focused);
  }, [bridge, focused]);
}

export function ClipboardOffer({
  activeFolderPath,
  bridge,
  onImported,
  uploadApi,
}: ClipboardOfferProps) {
  const [offer, setOffer] = useState<CaptureImageAvailable | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!bridge) return;
    void bridge.refreshWatch();
    return bridge.onImageAvailable((image) => {
      if (!image.mime.startsWith('image/')) return;
      setFailure(null);
      setOffer(image);
    });
  }, [bridge]);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const dismiss = useCallback(() => {
    if (!offer || pending) return;
    bridge?.markHandled(offer.hash);
    setOffer(null);
    setFailure(null);
  }, [bridge, offer, pending]);

  const add = useCallback(async () => {
    if (!offer || !activeFolderPath || pending) return;
    const blob = dataUrlToBlob(offer.dataUrl, offer.mime);
    if (!blob) {
      setFailure('Could not save the clipboard image.');
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPending(true);
    setFailure(null);
    try {
      const [outcome] = await uploadApi.upload(
        activeFolderPath,
        [{ blob, name: offer.filename }],
        current.signal,
      );
      if (!outcome || outcome.error) throw new Error(outcome?.error ?? 'upload rejected');
      bridge?.markHandled(offer.hash);
      setOffer(null);
      onImported?.({ folderPath: activeFolderPath, path: outcome.file });
    } catch {
      if (!current.signal.aborted) setFailure('Could not save the clipboard image.');
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setPending(false);
      }
    }
  }, [activeFolderPath, bridge, offer, onImported, pending, uploadApi]);

  const open = offer !== null && activeFolderPath !== null;
  return (
    <Dialog onOpenChange={(next) => !next && dismiss()} open={open}>
      <DialogContent closeDisabled={pending} size="sm">
        <DialogHeader>
          <DialogTitle>Add image to StashBase?</DialogTitle>
          <DialogDescription>
            There&rsquo;s an image on your clipboard. Add it to this folder &mdash; its text gets
            extracted so you can search it later.
          </DialogDescription>
        </DialogHeader>
        {failure && (
          <p className="mt-1 text-caption text-destructive" role="alert">
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button disabled={pending} onClick={dismiss} variant="tertiary">
            Dismiss
          </Button>
          <Button loading={pending} onClick={() => void add()} variant="primary">
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

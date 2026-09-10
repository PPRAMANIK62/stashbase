import { useCallback, useRef, useState } from 'react';

import { copyFailureMessage } from '@/features/gallery/application/failure-messages';
import type { GalleryPort } from '@/features/gallery/application/ports';
import type { GalleryEntry } from '@/features/gallery/domain/entry';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

export interface GalleryCopyState {
  /** The entry currently being copied, or null. One at a time: the button is
   *  large and inviting, and two copies must be two deliberate acts rather
   *  than one bounce. */
  copyingId: string | null;
  issue: string | null;
  copy(entry: GalleryEntry): void;
}

export function useGalleryCopy(port: Pick<GalleryPort, 'copy'>): GalleryCopyState {
  const signalFor = useRequestSignals<'copy'>();
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const inFlight = useRef(false);

  const copy = useCallback(
    (entry: GalleryEntry) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setCopyingId(entry.id);
      setIssue(null);
      const signal = signalFor('copy');
      void (async () => {
        try {
          await port.copy({ name: entry.name, repo: entry.repo }, signal);
        } catch (error) {
          // The Library is unchanged by a failed copy, so the entry stays on
          // screen and the same button retries it.
          setIssue(copyFailureMessage(error));
        } finally {
          inFlight.current = false;
          setCopyingId(null);
        }
      })();
    },
    [port, signalFor],
  );

  return { copy, copyingId, issue };
}

import { useCallback, useEffect, useRef, useState } from 'react';

import type { MediaDocumentAsset } from '@/features/documents/application/ports';
import { mediaKind } from '@/features/documents/domain/media';

/** Direct source playback; unsupported codecs remain ordinary project files. */
export function MediaDocument({
  active,
  name,
  path,
  resource,
}: {
  active: boolean;
  name: string;
  path: string;
  resource: MediaDocumentAsset;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const assignMedia = useCallback(
    (element: HTMLMediaElement | null) => {
      if (!element) return;
      element.setAttribute('src', resource.url);
      mediaRef.current = element;
      return () => {
        mediaRef.current = null;
        element.pause();
        element.removeAttribute('src');
        element.load();
      };
    },
    [resource.url],
  );

  useEffect(() => {
    if (!active) mediaRef.current?.pause();
  }, [active]);

  return (
    <section
      aria-label="Media playback"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-5"
    >
      {unavailable ? (
        <p className="text-caption text-muted-foreground" role="status">
          This file cannot be played here. Open the source in an external application.
        </p>
      ) : mediaKind(path) === 'video' ? (
        // Local source preview has no supplied caption track.
        <video
          aria-label={`${name} playback`}
          className="max-h-full max-w-full"
          controls
          onError={() => setUnavailable(true)}
          preload="metadata"
          ref={assignMedia}
        />
      ) : (
        <audio
          aria-label={`${name} playback`}
          className="w-full max-w-2xl"
          controls
          onError={() => setUnavailable(true)}
          preload="metadata"
          ref={assignMedia}
        />
      )}
    </section>
  );
}

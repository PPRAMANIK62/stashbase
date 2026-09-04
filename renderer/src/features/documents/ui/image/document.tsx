import { Expand, Maximize2, Minus, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { DocumentAsset } from '@/features/documents/application/ports';
import {
  ViewerToolbar,
  ViewerToolbarButton,
  ViewerToolbarValue,
} from '@/features/documents/ui/viewer-toolbar';

import { ImageLightbox } from './lightbox';
import { MAX_IMAGE_SCALE, MIN_IMAGE_SCALE, useImageScale } from './use-image-scale';

export function ImageDocument({ name, resource }: { name: string; resource: DocumentAsset }) {
  const [natural, setNatural] = useState<{ height: number; width: number } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const image = useImageScale(viewportRef, natural, resource.version);

  useEffect(() => {
    setNatural(null);
    setLoadFailed(false);
    setLightboxOpen(false);
  }, [resource.version]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const zoom = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      image.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    viewport.addEventListener('wheel', zoom, { passive: false });
    return () => viewport.removeEventListener('wheel', zoom);
  }, [image]);

  const dpr = globalThis.devicePixelRatio || 1;
  const width = natural ? Math.round((natural.width / dpr) * image.scale) : undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface-2">
      <ViewerToolbar label="Image controls">
        <ViewerToolbarButton label="Zoom out" onClick={() => image.zoomBy(1 / 1.2)}>
          <Minus aria-hidden="true" />
        </ViewerToolbarButton>
        <ViewerToolbarValue
          label="Zoom percentage"
          max={MAX_IMAGE_SCALE * 100}
          min={MIN_IMAGE_SCALE * 100}
          onCommit={image.setPercentage}
          onSingleClick={image.actual}
          suffix="%"
          title="Actual size; double-click to set zoom"
          value={Math.round(image.scale * 100)}
        />
        <ViewerToolbarButton
          active={image.mode === 'fit'}
          aria-pressed={image.mode === 'fit'}
          label="Fit to view"
          onClick={image.fit}
        >
          <Maximize2 aria-hidden="true" />
        </ViewerToolbarButton>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
        <ViewerToolbarButton label="Enlarge image" onClick={() => setLightboxOpen(true)}>
          <Expand aria-hidden="true" />
        </ViewerToolbarButton>
      </ViewerToolbar>
      <div className="min-h-0 flex-1 overflow-auto" ref={viewportRef}>
        {loadFailed ? (
          <ImageStatus failed name={name} retry={() => setLoadFailed(false)} />
        ) : (
          <div className="flex min-h-full min-w-full items-center justify-center px-6 pt-16 pb-6">
            <img
              alt={name}
              className="block h-auto flex-none shadow-surface-3"
              draggable={false}
              onError={() => setLoadFailed(true)}
              onLoad={(event) =>
                setNatural({
                  height: event.currentTarget.naturalHeight,
                  width: event.currentTarget.naturalWidth,
                })
              }
              src={resource.url}
              style={width ? { width } : undefined}
            />
          </div>
        )}
      </div>
      {!loadFailed && (
        <ImageLightbox
          alt={name}
          onOpenChange={setLightboxOpen}
          open={lightboxOpen}
          src={resource.url}
        />
      )}
    </div>
  );
}

function ImageStatus({
  failed = false,
  name,
  retry,
}: {
  failed?: boolean;
  name: string;
  retry?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center px-6 text-center">
      <div>
        <p className="text-body font-medium">
          {failed ? `Could not open ${name}` : `Loading ${name}`}
        </p>
        {failed && (
          <>
            <p className="mt-1 text-caption text-muted-foreground" role="alert">
              The image may have moved, changed, or become unavailable.
            </p>
            <Button
              className="mt-4"
              leadingIcon={RefreshCw}
              onClick={retry}
              size="compact"
              variant="tertiary"
            >
              Retry
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

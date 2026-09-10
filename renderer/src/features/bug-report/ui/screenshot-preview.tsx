/**
 * The exact retained PNG, inspectable without cropping: it opens fitted to
 * the frame, and zooms from there by the buttons, the wheel, the keyboard,
 * or a two-finger pinch. Zoom keeps the point under the pointer still, so
 * the reader can drive into one corner and read it.
 *
 * The frame is the scroll-area primitive, whose viewport is what scrolls and
 * what takes focus. Its listeners are attached imperatively rather than as
 * JSX handlers: the wheel one has to be non-passive to stop the page
 * scrolling under a zoom, and React registers wheel as passive.
 */
import { Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ArtifactPreview } from '@/features/bug-report/domain/review-session';

type ScreenshotPreviewValue = Extract<ArtifactPreview, { kind: 'screenshot' }>;

const ZOOM_STEP = 1.25;
const WHEEL_SENSITIVITY = 0.002;
const LINE_HEIGHT_PX = 16;

interface Anchor {
  readonly contentX: number;
  readonly contentY: number;
  readonly previousHeight: number;
  readonly previousWidth: number;
  readonly viewportX: number;
  readonly viewportY: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function pinchOf(pointers: Map<number, Point>): { distance: number; x: number; y: number } | null {
  const [a, b] = [...pointers.values()];
  if (!a || !b || pointers.size !== 2) return null;
  return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** The scroll-area primitive's viewport, published under this slot name. */
const VIEWPORT = '[data-slot="scroll-area-viewport"]';

export function ScreenshotPreview({ preview }: { preview: ScreenshotPreviewValue }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLElement | null>(null);
  const anchorRef = useRef<Anchor | null>(null);
  const [failed, setFailed] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);

  const displayWidth = Math.max(1, Math.round(preview.width * fitScale * zoom));
  const displayHeight = Math.max(1, Math.round(preview.height * fitScale * zoom));
  const atFit = zoom <= 1.001;
  const atFullSize = Math.abs(fitScale * zoom - 1) < 0.01;

  const measureFit = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return 1;
    const width = Math.max(1, frame.clientWidth - 2);
    const height = Math.max(1, frame.clientHeight - 2);
    return Math.min(1, width / preview.width, height / preview.height);
  }, [preview.height, preview.width]);

  /** Zooms to `next` (a multiple of the fitted size), keeping the point at
   *  `clientX`/`clientY` — the frame's centre when absent — where it is. */
  const zoomTo = useCallback(
    (next: number, clientX?: number, clientY?: number): boolean => {
      const clamped = Math.min(Math.max(4, 1 / fitScale), Math.max(1, next));
      const frame = frameRef.current;
      if (frame) {
        const rect = frame.getBoundingClientRect();
        const viewportX = clientX === undefined ? frame.clientWidth / 2 : clientX - rect.left;
        const viewportY = clientY === undefined ? frame.clientHeight / 2 : clientY - rect.top;
        anchorRef.current = {
          contentX: frame.scrollLeft + viewportX,
          contentY: frame.scrollTop + viewportY,
          previousHeight: displayHeight,
          previousWidth: displayWidth,
          viewportX,
          viewportY,
        };
      }
      setZoom(clamped);
      return Math.abs(clamped - zoom) > 0.001;
    },
    [displayHeight, displayWidth, fitScale, zoom],
  );
  const zoomToRef = useRef(zoomTo);
  zoomToRef.current = zoomTo;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const fitToView = useCallback(() => {
    setFitScale(measureFit());
    setZoom(1);
  }, [measureFit]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (!frame || !anchor || anchor.previousWidth <= 0 || anchor.previousHeight <= 0) return;
    frame.scrollLeft = (anchor.contentX / anchor.previousWidth) * displayWidth - anchor.viewportX;
    frame.scrollTop = (anchor.contentY / anchor.previousHeight) * displayHeight - anchor.viewportY;
  }, [displayHeight, displayWidth]);

  useEffect(() => {
    const frame = rootRef.current?.querySelector<HTMLElement>(VIEWPORT) ?? null;
    frameRef.current = frame;
    if (!frame) return;
    const pointers = new Map<number, Point>();
    let pinchDistance: number | null = null;

    const onWheel = (event: WheelEvent) => {
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * LINE_HEIGHT_PX
          : event.deltaY;
      const factor = Math.exp(-delta * WHEEL_SENSITIVITY);
      if (zoomToRef.current(zoomRef.current * factor, event.clientX, event.clientY)) {
        event.preventDefault();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const step = { '+': ZOOM_STEP, '-': 1 / ZOOM_STEP, '=': ZOOM_STEP }[event.key];
      if (step !== undefined) {
        event.preventDefault();
        zoomToRef.current(zoomRef.current * step);
      } else if (event.key === '0') {
        event.preventDefault();
        zoomToRef.current(1);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      frame.setPointerCapture(event.pointerId);
      pinchDistance = pinchOf(pointers)?.distance ?? null;
    };
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = pinchOf(pointers);
      if (pinch && pinchDistance) {
        event.preventDefault();
        zoomToRef.current(zoomRef.current * (pinch.distance / pinchDistance), pinch.x, pinch.y);
        pinchDistance = pinch.distance;
      } else if (pointers.size === 1 && zoomRef.current > 1.001) {
        event.preventDefault();
        frame.scrollLeft -= event.clientX - previous.x;
        frame.scrollTop -= event.clientY - previous.y;
      }
    };
    const release = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinchDistance = pinchOf(pointers)?.distance ?? null;
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    frame.addEventListener('keydown', onKeyDown);
    frame.addEventListener('pointerdown', onPointerDown);
    frame.addEventListener('pointermove', onPointerMove);
    frame.addEventListener('pointerup', release);
    frame.addEventListener('pointercancel', release);
    const observer = new ResizeObserver(() => {
      if (zoomRef.current <= 1.001) fitToView();
    });
    observer.observe(frame);
    return () => {
      frame.removeEventListener('wheel', onWheel);
      frame.removeEventListener('keydown', onKeyDown);
      frame.removeEventListener('pointerdown', onPointerDown);
      frame.removeEventListener('pointermove', onPointerMove);
      frame.removeEventListener('pointerup', release);
      frame.removeEventListener('pointercancel', release);
      observer.disconnect();
    };
  }, [fitToView]);

  if (failed) {
    return <p className="text-caption text-destructive">This preview is unavailable.</p>;
  }

  return (
    <>
      <p className="text-caption text-muted-foreground">
        The exact capture that will be attached. Scroll or pinch to zoom.
      </p>
      <ScrollArea
        aria-label="Zoomable screenshot preview"
        className="h-[min(418px,70svh)] touch-none rounded-md border border-border bg-surface-2"
        orientation="both"
        ref={rootRef}
        role="group"
      >
        <div style={{ height: displayHeight, width: displayWidth }}>
          <img
            alt="Exact screenshot of the StashBase window where reporting began"
            className="block max-w-none"
            height={displayHeight}
            onError={() => setFailed(true)}
            onLoad={fitToView}
            src={preview.dataUrl}
            width={displayWidth}
          />
        </div>
      </ScrollArea>
      <div aria-label="Screenshot zoom controls" className="flex items-center gap-2" role="group">
        <Button
          aria-label="Zoom out"
          disabled={atFit}
          onClick={() => zoomTo(zoom / ZOOM_STEP)}
          size="icon-compact"
          type="button"
          variant="tertiary"
        >
          <Minus />
        </Button>
        <output aria-live="polite" className="min-w-12 text-center text-caption tabular-nums">
          {Math.round(fitScale * zoom * 100)}%
        </output>
        <Button
          aria-label="Zoom in"
          onClick={() => zoomTo(zoom * ZOOM_STEP)}
          size="icon-compact"
          type="button"
          variant="tertiary"
        >
          <Plus />
        </Button>
        <Button
          disabled={atFullSize}
          onClick={() => zoomTo(1 / fitScale)}
          size="compact"
          type="button"
          variant="tertiary"
        >
          View full size
        </Button>
        <Button
          disabled={atFit}
          onClick={fitToView}
          size="compact"
          type="button"
          variant="tertiary"
        >
          Fit to view
        </Button>
      </div>
    </>
  );
}

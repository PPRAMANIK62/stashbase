import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  ViewerToolbar,
  ViewerToolbarButton,
  ViewerToolbarValue,
} from '@/features/documents/ui/viewer-toolbar';
import { cn } from '@/lib/utils';

import { clampImageScale, MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from './use-image-scale';

export function ImageLightbox({
  alt,
  onOpenChange,
  open,
  src,
}: {
  alt: string;
  onOpenChange(open: boolean): void;
  open: boolean;
  src: string;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [open, src]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage) return;
    const zoom = (event: WheelEvent) => {
      event.preventDefault();
      setScale((current) => clampImageScale(current * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    };
    stage.addEventListener('wheel', zoom, { passive: false });
    return () => stage.removeEventListener('wheel', zoom);
  }, [open]);

  const reset = () => {
    drag.current = null;
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const zoomBy = (factor: number) => {
    setScale((current) => {
      const next = clampImageScale(current * factor);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const setPercentage = (percentage: number) => {
    setScale((current) => {
      const next = clampImageScale(percentage / 100);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return Number.isFinite(next) ? next : current;
    });
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const x = event.clientX - drag.current.x;
    const y = event.clientY - drag.current.y;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };

  return (
    <Dialog modal onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-label={`${alt} enlarged preview`}
        className="flex h-[calc(100%-2rem)] max-w-[calc(100%-2rem)] flex-col overflow-hidden p-0"
        onKeyDown={(event) => {
          if (event.key === '+' || event.key === '=') zoomBy(1.2);
          else if (event.key === '-') zoomBy(1 / 1.2);
          else if (event.key === '0') reset();
          else if (scale > 1 && event.key.startsWith('Arrow')) {
            event.preventDefault();
            const step = 48;
            setOffset((current) => ({
              x:
                current.x +
                (event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0),
              y:
                current.y +
                (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0),
            }));
          }
        }}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <DialogDescription className="sr-only">
          Use the controls to zoom. When zoomed in, drag the image or use the arrow keys to pan.
        </DialogDescription>
        <div
          className={cn(
            'grid min-h-0 flex-1 touch-none place-items-center overflow-hidden bg-surface-1',
            scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
          )}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={stageRef}
        >
          <img
            alt={alt}
            className="max-h-[calc(100vh-7rem)] max-w-[calc(100vw-4rem)] origin-center object-contain shadow-surface-4 select-none"
            draggable={false}
            src={src}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          />
        </div>
        <ViewerToolbar className="px-1.5" label="Image zoom controls">
          <ViewerToolbarButton label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
            <Minus aria-hidden="true" />
          </ViewerToolbarButton>
          <ViewerToolbarValue
            label="Zoom percentage"
            max={MAX_IMAGE_SCALE * 100}
            min={MIN_IMAGE_SCALE * 100}
            onCommit={setPercentage}
            onSingleClick={reset}
            suffix="%"
            title="Actual size; double-click to set zoom"
            value={Math.round(scale * 100)}
          />
          <ViewerToolbarButton label="Zoom in" onClick={() => zoomBy(1.2)}>
            <Plus aria-hidden="true" />
          </ViewerToolbarButton>
        </ViewerToolbar>
      </DialogContent>
    </Dialog>
  );
}

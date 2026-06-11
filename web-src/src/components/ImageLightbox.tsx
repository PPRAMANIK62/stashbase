import { useEffect, useRef, useState, type PointerEvent } from 'react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt = '', onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    // Inline the zoom/reset logic off the stable state setters so the
    // listener binds once per `onClose` rather than re-binding on every
    // render (each zoom/pan tick re-renders).
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === '0') { setScale(1); setOffset({ x: 0, y: 0 }); }
      else if (e.key === '+' || e.key === '=') setScale((v) => clamp(v * 1.2));
      else if (e.key === '-') setScale((v) => clamp(v / 1.2));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // React's delegated wheel events are not reliable for blocking the
  // browser's default scroll/zoom behavior in Electron. Match ImagePreview:
  // bind a native passive:false listener directly to the stage.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setScale((v) => {
        const next = clamp(v * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
        if (next <= 1) {
          setOffset({ x: 0, y: 0 });
          dragRef.current = null;
        }
        return next;
      });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function zoomBy(factor: number) {
    setScale((v) => {
      const next = clamp(v * factor);
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
        dragRef.current = null;
      }
      return next;
    });
  }

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (scale <= 1) return;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
  }

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
      <div className="image-lightbox-toolbar">
        <div className="image-lightbox-title">{alt || 'Image preview'}</div>
        <button type="button" onClick={() => zoomBy(1 / 1.2)}>Zoom out</button>
        <span className="image-lightbox-scale">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.2)}>Zoom in</button>
        <button type="button" onClick={reset}>Reset</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <div
        ref={stageRef}
        className={'image-lightbox-stage' + (scale > 1 ? ' pannable' : '')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
}

function clamp(value: number): number {
  return Math.min(6, Math.max(0.2, value));
}

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Button } from '@/common/components/ui/button';
import { useFocusTrap } from '@/common/hooks/useFocusTrap';
import { cn } from '@/common/lib/utils';

/** Keyboard pan distance per arrow press on a zoomed image — the keyboard
 *  counterpart of the pointer drag, in the same screen pixels the drag
 *  deltas use. */
const PAN_STEP = 48;

export function ImageLightbox({ src, alt = '', onClose }: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  // Real modality behind the `aria-modal` promise: focus moves onto the
  // dialog on open (the root carries tabindex so no arbitrary control gets
  // spotlit), Tab cycles the stage controls, and closing hands focus back
  // to whatever opened the lightbox.
  const dialogRef = useFocusTrap<HTMLDivElement>();
  const zoomed = scale > 1;

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    // Inline the zoom/reset logic off the stable state setters so the
    // listener binds once per `onClose` plus the zoomed/unzoomed threshold
    // crossing, rather than re-binding on every render (each zoom/pan tick
    // re-renders).
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === '0') { setScale(1); setOffset({ x: 0, y: 0 }); }
      else if (e.key === '+' || e.key === '=') setScale((v) => clamp(v * 1.2));
      else if (e.key === '-') setScale((v) => clamp(v / 1.2));
      else if (zoomed && e.key.startsWith('Arrow')) {
        // Arrow keys pan a zoomed image the way arrows scroll a viewport:
        // ArrowDown reveals what is below, so the image moves up.
        const dx = e.key === 'ArrowLeft' ? PAN_STEP : e.key === 'ArrowRight' ? -PAN_STEP : 0;
        const dy = e.key === 'ArrowUp' ? PAN_STEP : e.key === 'ArrowDown' ? -PAN_STEP : 0;
        if (dx === 0 && dy === 0) return;
        e.preventDefault();
        setOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, zoomed]);

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

  function download() {
    const link = document.createElement('a');
    link.href = src;
    link.download = safeDownloadName(alt);
    link.click();
    link.remove();
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
    /* The dark scrim is a deliberate overlay color, independent of the
     * app theme — the lightbox always reads as a dark stage. The
     * `quick-open-blocking` marker keeps Quick Open from opening on top. */
    <div ref={dialogRef} className="quick-open-blocking fixed inset-0 z-modal flex flex-col bg-scrim text-white outline-none" role="dialog" aria-modal="true" aria-label="Image preview" tabIndex={-1}>
      <div
        ref={stageRef}
        className={cn(
          'grid min-h-0 flex-1 touch-none place-items-center overflow-hidden',
          scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          className="max-h-overlay-stage max-w-overlay-stage origin-center object-contain shadow-stage transition-transform duration-fast ease-out select-none"
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>
      <div className="absolute top-4 right-4 z-raised flex gap-2">
        <StageButton label="Download image" title="Download" onClick={download}>
          <LightboxIcon kind="download" />
        </StageButton>
        <StageButton label="Close image preview" title="Close" onClick={onClose}>
          <LightboxIcon kind="close" />
        </StageButton>
      </div>
      {/* The toolbar's own near-opaque slate: the stage is always dark, so
        * this is a fixed overlay colour rather than a theme role — no token
        * names "the chrome that floats on a dark stage". */}
      <div className="absolute bottom-5 left-1/2 z-raised flex -translate-x-1/2 items-center gap-1 rounded-full bg-[rgba(38,39,42,0.96)] p-1 shadow-elevation">
        <StageButton label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <ZoomGlyph />
        </StageButton>
        <span className="min-w-[66px] text-center text-base text-white/80 tabular-nums">{Math.round(scale * 100)}%</span>
        <StageButton label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.2)}>
          <ZoomGlyph plus />
        </StageButton>
      </div>
    </div>
  );
}

/* The lightbox is a deliberate always-dark stage, independent of the app
 * theme (light mode must not lighten it). The scrim uses the theme-static
 * `bg-scrim` role (`--scrim` in globals.css); the raised toolbar is a raw
 * lighter step of the same near-black, so the two read as one dark system
 * rather than two unrelated darks.
 *
 * This is the one floating surface that is NOT `bg-popover`, and the
 * exception is the point: the toolbar and the circular controls belong to
 * the dark room, not to the app chrome. Folding them into the chrome roles
 * would make them flip with the theme on a stage that never flips. The
 * stage's own drop shadow is theme-static for the same reason — see
 * `--shadow-stage` in globals.css. */
/** 40px circular white-on-dark control — always styled for the dark
 *  stage, never the app theme. Stays `no-drag` so the frameless-window
 *  drag region can't swallow clicks near the top edge.
 *
 *  This is the `Button` primitive under a theme-static palette, and the
 *  split is the point: the recipe owns the press scale, the focus ring and
 *  the transition (this used to re-spell `transition-control` and
 *  `active:scale-97` by hand, which is exactly what the primitive exists to
 *  stop duplicating), while the className below carries only what the dark
 *  stage decides — a circle, a white-on-translucent-white palette that must
 *  NOT flip with the app theme, and the drag-region opt-out. It stays a
 *  className rather than a `Button` variant on purpose: nothing else in the
 *  app is allowed to look like this. It is a component rather than the
 *  shared class string it used to be because all four stage controls also
 *  agree on `ghost` and `icon-lg`, and a class string could only carry one
 *  of the three decisions. */
function StageButton({ label, title, onClick, children }: {
  /** Accessible name — the glyph is the only label these controls have. */
  label: string;
  /** Hover title. Shorter than the accessible name where the surrounding
   *  dialog already supplies the noun ("Close", not "Close image
   *  preview"). */
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="size-10 cursor-pointer rounded-full border-0 bg-white/10 p-0 text-white hover:bg-white/15 hover:text-white dark:hover:bg-white/15 [font-family:inherit] [-webkit-app-region:no-drag]"
      aria-label={label}
      title={title}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function LightboxIcon({ kind }: { kind: 'download' | 'close' }) {
  const common = {
    /* 16px, the step the 40px stage control takes — the same one
     * `ZoomGlyph` beside it already uses. 15 was off the 12/14/16 ramp. */
    className: 'size-4',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (kind === 'download') return (
    <svg {...common}><path d="M8 2.25v7.5m0 0 2.7-2.7M8 9.75 5.3 7.05M3 10.75v2h10v-2" /></svg>
  );
  return <svg {...common}><path d="m3.5 3.5 9 9m0-9-9 9" /></svg>;
}

function ZoomGlyph({ plus = false }: { plus?: boolean }) {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M3.5 8h9" />
      {plus && <path d="M8 3.5v9" />}
    </svg>
  );
}

function safeDownloadName(name: string): string {
  const trimmed = name.trim();
  return trimmed && !/[\\/:*?"<>|]/.test(trimmed) ? trimmed : 'image';
}

function clamp(value: number): number {
  return Math.min(6, Math.max(0.2, value));
}

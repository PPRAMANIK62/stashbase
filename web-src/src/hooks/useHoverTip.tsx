import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Hover tooltip for chrome buttons. The native HTML `title` tooltip is
 * unreliable in this Electron window (custom `hiddenInset` title bar — it
 * never appears on the rail, and the `app-chrome` drag region swallows it
 * entirely), so we render our own. It's `position: fixed` so it escapes
 * the sidebar's `overflow: hidden` (the rail lives inside it); a pure-CSS
 * `::after` bubble would be clipped to the 44px rail.
 *
 * Returns props to spread on the trigger (no wrapper element, so the
 * button stays a direct flex child and the rail layout is untouched) and
 * the bubble node to drop inside it. Shows after a 600ms hover, matching
 * the OS tooltip delay; hides on leave or press.
 *
 * Placement is a *preference*: `right` of the trigger (rail icons) or
 * `bottom` (top-chrome buttons). Either way the bubble is measured and
 * clamped into the viewport, so a button near the window's right edge
 * (e.g. the top-right agent launchers) doesn't get its label cut off.
 *
 *   const { tipProps, tip } = useHoverTip('Settings');
 *   return <button {...tipProps}>{icon}{tip}</button>;
 */
export function useHoverTip(label: string, placement: 'right' | 'bottom' = 'right') {
  // `anchor` is the raw edge point captured on hover; `pos` is the final
  // viewport-clamped top/left, computed once the bubble is measured.
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<number | null>(null);

  function clear() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }
  // A stuck timer firing after unmount would setState on a dead component.
  useEffect(() => clear, []);

  // Measure-then-clamp: the bubble renders at the anchor (hidden until
  // measured), then we position its top-left exactly so it never spills
  // off-screen. Re-runs whenever the anchor moves.
  useLayoutEffect(() => {
    if (!anchor || !tipRef.current) { setPos(null); return; }
    const t = tipRef.current.getBoundingClientRect();
    const M = 8; // viewport margin
    let left = placement === 'bottom' ? anchor.x - t.width / 2 : anchor.x;
    let top = placement === 'bottom' ? anchor.y : anchor.y - t.height / 2;
    left = Math.max(M, Math.min(left, window.innerWidth - t.width - M));
    top = Math.max(M, Math.min(top, window.innerHeight - t.height - M));
    setPos({ top, left });
  }, [anchor, placement]);

  const tipProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      // currentTarget is only valid synchronously — snapshot the rect now,
      // use it when the delay fires. `anchor` is the edge the bubble grows
      // from: the button's right-center (right) or bottom-center (bottom).
      const r = e.currentTarget.getBoundingClientRect();
      clear();
      timer.current = window.setTimeout(() => {
        setAnchor(placement === 'bottom'
          ? { x: r.left + r.width / 2, y: r.bottom + 6 }
          : { x: r.right + 8, y: r.top + r.height / 2 });
      }, 600);
    },
    onMouseLeave: () => { clear(); setAnchor(null); },
    onMouseDown: () => { clear(); setAnchor(null); },
  };

  const tip = anchor
    ? (
      <span
        ref={tipRef}
        className="hover-tip"
        style={{ top: pos?.top ?? anchor.y, left: pos?.left ?? anchor.x, visibility: pos ? 'visible' : 'hidden' }}
        role="tooltip"
      >
        {label}
      </span>
    )
    : null;

  return { tipProps, tip };
}

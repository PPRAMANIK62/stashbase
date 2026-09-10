/** The traveling overlays a sidebar menu paints under its rows: the active
 *  background(s), the hover background, and the keyboard focus ring.
 *
 *  All three are absolutely positioned inside the menu's own coordinate space
 *  and GLIDE between rows, so the hover moves from a parent into its children
 *  as one continuous piece. The active background stays one per level (the
 *  root rows, and each sub-menu) so a current section and the current page
 *  inside it can both be lit.
 *
 *  A rect change has two causes with two right answers. The highlight moving
 *  to a DIFFERENT row springs — that is the glide. The same row itself moving
 *  — a sibling sub-tree collapsing above reflows every row below on every
 *  frame of its own spring — must snap, or the overlay chases the row it is
 *  sitting on with a trailing second spring. */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';

import { FOCUS_RING_BORDER } from '@/lib/focus-ring';
import { useShape } from '@/lib/shape-context';
import { spring, tween } from '@/lib/springs';
import { useIsoLayoutEffect } from '@/lib/use-iso-layout-effect';
import { instant, useMotionTier } from '@/lib/use-motion-tier';
import type { ItemRect } from '@/lib/use-proximity-hover';

/** Stable keys for the per-level active overlays: one key per sub-menu <ul>
 *  (or the menu root), so the active background glides when the active row
 *  moves within its level instead of remounting.
 *
 *  Each SidebarMenuSub stamps its own `useId()` on its <ul>, so the key is
 *  minted by React with the component instance rather than by a module-level
 *  counter and a WeakMap that outlive every menu on the page. The scope's own
 *  container carries no stamp: within one menu there is exactly one root. */
const overlayGroupId = (el: Element) => el.getAttribute('data-menu-level') ?? 'root';

interface MenuOverlaysProps {
  /** Every visible active row, in DOM order. */
  activeRows: HTMLElement[];
  hoveredRowEl: HTMLElement | null;
  focusedRowEl: HTMLElement | null;
  /** A row's box within the menu's coordinate space, clamped to its button. */
  overlayRect: (row: HTMLElement | null) => ItemRect | null;
  /** Which level a row's active background belongs to — its sub-menu <ul>, or
   *  the menu root. */
  rowLevel: (row: HTMLElement) => Element | null;
  /** The proximity system's hover session. A new session remounts the hover
   *  background so it fades in from the active row again. */
  sessionKey: number;
}

export function MenuOverlays({
  activeRows,
  hoveredRowEl,
  focusedRowEl,
  overlayRect,
  rowLevel,
  sessionKey,
}: MenuOverlaysProps) {
  const shape = useShape();
  // A rect change has two causes: the highlight moving to a DIFFERENT row
  // glides, the same row moving under it snaps (see the header).
  const glide = useMotionTier({ ...spring.moderate, opacity: tween.fast });
  const glideOut = useMotionTier(spring.moderate.exit);
  const slide = useMotionTier({ ...spring.fast, opacity: tween.fast });
  const fadeOut = useMotionTier(spring.fast.exit);

  // Targets are compared against the previous COMMIT (the effect below), not
  // the previous render, so strict mode's double render can't eat a genuine
  // row change.
  const prevTargetsRef = useRef<{
    hover: HTMLElement | null;
    focus: HTMLElement | null;
    actives: Map<string, HTMLElement>;
  }>({ hover: null, focus: null, actives: new Map() });

  // Keys are the row's level plus its occurrence within that level: the usual
  // case — one active per level, e.g. a current section marker plus the
  // current page inside its sub-tree — keeps a stable key, so the background
  // GLIDES when the selection moves instead of remounting.
  const levelOccurrence = new Map<string, number>();
  const levelFirstActive = new Map<string, HTMLElement>();
  const activeRects: { key: string; rect: ItemRect; rowChanged: boolean }[] = [];
  const committedActives = new Map<string, HTMLElement>();
  for (const row of activeRows) {
    const level = rowLevel(row);
    if (!level) continue;
    const levelId = overlayGroupId(level);
    const occurrence = levelOccurrence.get(levelId) ?? 0;
    levelOccurrence.set(levelId, occurrence + 1);
    if (!levelFirstActive.has(levelId)) levelFirstActive.set(levelId, row);
    const rect = overlayRect(row);
    if (!rect) continue;
    const key = `${levelId}:${occurrence}`;
    committedActives.set(key, row);
    activeRects.push({ key, rect, rowChanged: prevTargetsRef.current.actives.get(key) !== row });
  }
  const hoverRect = overlayRect(hoveredRowEl);
  const focusRect = overlayRect(focusedRowEl);
  const hoverRowChanged = prevTargetsRef.current.hover !== hoveredRowEl;
  const focusRowChanged = prevTargetsRef.current.focus !== focusedRowEl;

  useIsoLayoutEffect(() => {
    prevTargetsRef.current = {
      hover: hoveredRowEl,
      focus: focusedRowEl,
      actives: committedActives,
    };
  });

  // The hover background fades in anchored on the active row of the hovered
  // row's own level (falling back to any active), so entering the menu reads
  // as the highlight detaching from where the selection lives.
  const hoveredLevel = hoveredRowEl ? rowLevel(hoveredRowEl) : null;
  const hoverAnchorRow =
    (hoveredLevel ? levelFirstActive.get(overlayGroupId(hoveredLevel)) : undefined) ??
    levelFirstActive.values().next().value;
  const hoverAnchorRect = hoverAnchorRow ? overlayRect(hoverAnchorRow) : null;

  return (
    <>
      {/* Active row backgrounds — one per active row (see activeRects above) */}
      <AnimatePresence>
        {activeRects.map(({ key, rect, rowChanged }) => (
          <motion.div
            key={key}
            className={`absolute ${shape.bg} pointer-events-none bg-active`}
            initial={false}
            animate={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              opacity: 1,
            }}
            exit={{ opacity: 0, transition: glideOut }}
            transition={rowChanged ? glide : instant}
          />
        ))}
      </AnimatePresence>

      {/* Hover background */}
      <AnimatePresence>
        {hoverRect && (
          <motion.div
            key={sessionKey}
            className={`absolute ${shape.bg} pointer-events-none bg-hover`}
            initial={{
              opacity: 0,
              top: hoverAnchorRect?.top ?? hoverRect.top,
              left: hoverAnchorRect?.left ?? hoverRect.left,
              width: hoverAnchorRect?.width ?? hoverRect.width,
              height: hoverAnchorRect?.height ?? hoverRect.height,
            }}
            animate={{
              opacity: 1,
              top: hoverRect.top,
              left: hoverRect.left,
              width: hoverRect.width,
              height: hoverRect.height,
            }}
            exit={{ opacity: 0, transition: fadeOut }}
            transition={hoverRowChanged ? slide : instant}
          />
        )}
      </AnimatePresence>

      {/* Focus ring */}
      <AnimatePresence>
        {focusRect && (
          <motion.div
            className={`absolute ${shape.focusRing} pointer-events-none z-20 border ${FOCUS_RING_BORDER}`}
            initial={false}
            animate={{
              left: focusRect.left - 2,
              top: focusRect.top - 2,
              width: focusRect.width + 4,
              height: focusRect.height + 4,
            }}
            exit={{ opacity: 0, transition: fadeOut }}
            transition={focusRowChanged ? slide : instant}
          />
        )}
      </AnimatePresence>
    </>
  );
}

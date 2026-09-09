/** The rect math behind `use-proximity-hover`, with no React in it.
 *
 *  Two coordinate spaces meet here. Item rects are *layout* values read from
 *  `offset*`, so they survive a CSS transform on an ancestor; the pointer
 *  arrives in *visual* viewport coordinates. `readContainerProjection` reads
 *  the one container that bridges them and `projectRect` carries a layout
 *  rect across, so the nearest-item search compares like with like.
 *
 *  Keeping it here means the geometry can be tested against numbers rather
 *  than through a rendered list, and the hook next door is left owning only
 *  registration, scheduling and state. */

/** An item's box in its container's layout coordinate space. */
export interface ItemRect {
  top: number;
  height: number;
  left: number;
  width: number;
}

/**
 * Which direction the nearest item is resolved along.
 *   "y"  — vertical lists (default): closest by top/height
 *   "x"  — horizontal strips: closest by left/width
 *   "xy" — 2-D grids: closest card across both rows AND columns,
 *          measured by Euclidean distance to each item's center
 */
export type ProximityAxis = 'x' | 'y' | 'xy';

/**
 * Measures one item in its container's coordinate space, or returns null when
 * the element has no layout box yet.
 *
 * An element inside a `display: none` / not-yet-laid-out popup has no
 * offsetParent and reports every offset as 0. Publishing that would pin
 * overlays to the top of the list, so a boxless element is reported as
 * unmeasurable instead. It is the only such case: `position: fixed` items also
 * have no offsetParent but do have a size.
 *
 * `offset*` is used rather than `getBoundingClientRect` so measurements are
 * unaffected by CSS transforms (e.g. a scaleY animation on a parent
 * motion.div). offsetTop/offsetLeft are layout values relative to the
 * offsetParent, matching the coordinate space `position: absolute` children
 * use. Items nested inside positioned descendants of the container (a sidebar
 * sub-menu's rows live inside a positioned row) accumulate those ancestors'
 * offsets, so every rect lands in the container's own space; for a flat list
 * the loop never runs and this is plain offsetTop/offsetLeft.
 */
export function measureItemRect(element: HTMLElement, container: HTMLElement): ItemRect | null {
  const hasLayoutBox =
    element.offsetParent !== null || element.offsetWidth > 0 || element.offsetHeight > 0;
  if (!hasLayoutBox) return null;
  let top = element.offsetTop;
  let left = element.offsetLeft;
  let ancestor = element.offsetParent;
  while (
    ancestor instanceof HTMLElement &&
    ancestor !== container &&
    container.contains(ancestor)
  ) {
    top += ancestor.offsetTop + ancestor.clientTop;
    left += ancestor.offsetLeft + ancestor.clientLeft;
    ancestor = ancestor.offsetParent;
  }
  return { top, height: element.offsetHeight, left, width: element.offsetWidth };
}

/**
 * A measured box as the motion values an overlay animates between.
 *
 * A type alias rather than an interface so it satisfies framer's
 * index-signature-shaped animation targets — which is also why every overlay
 * in the kit reads its target from here instead of spelling the same four-key
 * literal out again under a local name.
 */
export type OverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/** An item's own box. */
export const overlayBox = (rect: ItemRect): OverlayBox => ({
  top: rect.top,
  left: rect.left,
  width: rect.width,
  height: rect.height,
});

/** The same box grown by `by` px on every side: a focus ring is drawn AROUND
 *  the item it names rather than on top of it. */
export const outsetBox = (rect: ItemRect, by: number): OverlayBox => ({
  top: rect.top - by,
  left: rect.left - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

/** True when two measurement passes describe the same layout, holes included.
 *  Lets a redundant remeasure skip its state update instead of churning a
 *  re-render through every consumer of the published rects. */
export function rectsMatch(
  previous: readonly (ItemRect | undefined)[],
  next: readonly (ItemRect | undefined)[],
): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < next.length; index++) {
    const before = previous[index];
    const after = next[index];
    if (before === after) continue; // both undefined (sparse slot)
    if (!before || !after) return false;
    if (
      before.top !== after.top ||
      before.left !== after.left ||
      before.width !== after.width ||
      before.height !== after.height
    ) {
      return false;
    }
  }
  return true;
}

/** Everything needed to carry a layout rect into visual viewport space: the
 *  container's own visual origin, its live scroll and border offsets, and the
 *  cumulative ancestor scale (X and Y scale independently). */
export interface ContainerProjection {
  readonly left: number;
  readonly top: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly borderX: number;
  readonly borderY: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export function readContainerProjection(container: HTMLElement): ContainerProjection {
  const bounds = container.getBoundingClientRect();
  return {
    left: bounds.left,
    top: bounds.top,
    scrollX: container.scrollLeft,
    scrollY: container.scrollTop,
    borderX: container.clientLeft,
    borderY: container.clientTop,
    // The bounding rect reflects any cumulative ancestor `transform: scale`;
    // offsetWidth/Height do not. Their ratio is that scale.
    scaleX: container.offsetWidth > 0 ? bounds.width / container.offsetWidth : 1,
    scaleY: container.offsetHeight > 0 ? bounds.height / container.offsetHeight : 1,
  };
}

/** A layout rect in the visual viewport space the pointer lives in. */
export function projectRect(rect: ItemRect, projection: ContainerProjection): ItemRect {
  return {
    left:
      projection.left + (projection.borderX + rect.left - projection.scrollX) * projection.scaleX,
    top: projection.top + (projection.borderY + rect.top - projection.scrollY) * projection.scaleY,
    width: rect.width * projection.scaleX,
    height: rect.height * projection.scaleY,
  };
}

interface ProximityQuery {
  readonly axis: ProximityAxis;
  /** Published item rects, indexed by item index and possibly sparse. */
  readonly rects: readonly (ItemRect | undefined)[];
  readonly pointerX: number;
  readonly pointerY: number;
  readonly projection: ContainerProjection;
  /** Items to hide from hit-testing without unregistering them. */
  readonly isSkipped?: (index: number) => boolean;
}

const spans = (position: number, start: number, size: number) =>
  position >= start && position <= start + size;

/**
 * The index the pointer is nearest, or null when nothing is measured.
 *
 * An item the pointer is actually inside always wins over a merely close one;
 * otherwise the smallest center distance takes it. The axis decides which
 * components of that distance count, so a vertical list ignores how far the
 * pointer strayed sideways while a grid weighs both — `Math.hypot(d, 0)` is
 * exactly `|d|`, which is why one loop serves all three modes.
 */
export function resolveNearestIndex(query: ProximityQuery): number | null {
  const { axis, rects, pointerX, pointerY, projection, isSkipped } = query;
  const usesX = axis !== 'y';
  const usesY = axis !== 'x';
  let closestIndex: number | null = null;
  let closestDistance = Infinity;
  let containingIndex: number | null = null;

  for (let index = 0; index < rects.length; index++) {
    const rect = rects[index];
    if (!rect) continue;
    if (isSkipped?.(index)) continue;

    const box = projectRect(rect, projection);
    const inside =
      (!usesX || spans(pointerX, box.left, box.width)) &&
      (!usesY || spans(pointerY, box.top, box.height));
    if (inside) containingIndex = index;

    const dx = usesX ? pointerX - (box.left + box.width / 2) : 0;
    const dy = usesY ? pointerY - (box.top + box.height / 2) : 0;
    const distance = Math.hypot(dx, dy);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return containingIndex ?? closestIndex;
}

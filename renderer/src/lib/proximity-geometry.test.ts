import { describe, expect, it } from 'vite-plus/test';

import {
  measureItemRect,
  projectRect,
  readContainerProjection,
  rectsMatch,
  resolveNearestIndex,
  type ContainerProjection,
  type ItemRect,
} from './proximity-geometry';

// happy-dom computes no layout, so every `offset*` the geometry reads is
// pinned by hand. The DOM tree itself is real: `contains` and `instanceof`
// decide where the ancestor walk stops.
interface Metrics {
  offsetParent?: Element | null;
  offsetTop?: number;
  offsetLeft?: number;
  offsetWidth?: number;
  offsetHeight?: number;
  clientTop?: number;
  clientLeft?: number;
}

function laidOut<T extends HTMLElement>(element: T, metrics: Metrics): T {
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(element, name, { configurable: true, value });
  }
  return element;
}

const box = (rect: Partial<ItemRect>): ItemRect => ({
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  ...rect,
});

/** A container with no scroll, border or ancestor transform. */
const identity: ContainerProjection = {
  left: 0,
  top: 0,
  scrollX: 0,
  scrollY: 0,
  borderX: 0,
  borderY: 0,
  scaleX: 1,
  scaleY: 1,
};

describe('measureItemRect', () => {
  it('reports a row with no layout box as unmeasurable', () => {
    const container = document.createElement('div');
    const row = laidOut(document.createElement('div'), {
      offsetParent: null,
      offsetWidth: 0,
      offsetHeight: 0,
    });
    container.append(row);

    // A row inside a popup that is in the DOM but not laid out reports every
    // offset as 0; publishing that would pin overlays to the top of the list.
    expect(measureItemRect(row, container)).toBeNull();
  });

  it('measures a flat row against the container itself', () => {
    const container = document.createElement('div');
    const row = laidOut(document.createElement('div'), {
      offsetParent: container,
      offsetTop: 48,
      offsetLeft: 8,
      offsetWidth: 200,
      offsetHeight: 24,
    });
    container.append(row);

    expect(measureItemRect(row, container)).toEqual({
      top: 48,
      left: 8,
      width: 200,
      height: 24,
    });
  });

  it('accumulates positioned ancestors up to the container', () => {
    const container = document.createElement('div');
    const positionedRow = laidOut(document.createElement('div'), {
      offsetParent: container,
      offsetTop: 100,
      offsetLeft: 10,
      clientTop: 1,
      clientLeft: 2,
    });
    const nested = laidOut(document.createElement('div'), {
      offsetParent: positionedRow,
      offsetTop: 5,
      offsetLeft: 3,
      offsetWidth: 180,
      offsetHeight: 20,
    });
    container.append(positionedRow);
    positionedRow.append(nested);

    // A sub-menu row lives inside a positioned row, so its offsets are relative
    // to that row; the walk lands it back in the container's own space.
    expect(measureItemRect(nested, container)).toEqual({
      top: 106,
      left: 15,
      width: 180,
      height: 20,
    });
  });

  it('stops the walk at an offsetParent outside the container', () => {
    const outer = document.createElement('div');
    const container = document.createElement('div');
    const row = laidOut(document.createElement('div'), {
      offsetParent: outer,
      offsetTop: 12,
      offsetLeft: 4,
      offsetWidth: 100,
      offsetHeight: 10,
    });
    outer.append(container);
    container.append(row);

    expect(measureItemRect(row, container)).toEqual({ top: 12, left: 4, width: 100, height: 10 });
  });
});

describe('rectsMatch', () => {
  const first = box({ top: 0, height: 24, width: 200 });
  const second = box({ top: 24, height: 24, width: 200 });

  it('matches two passes that describe the same layout, holes included', () => {
    const sparse: (ItemRect | undefined)[] = [first];
    sparse[2] = second;
    const same: (ItemRect | undefined)[] = [{ ...first }];
    same[2] = { ...second };

    expect(rectsMatch([first, second], [{ ...first }, { ...second }])).toBe(true);
    expect(rectsMatch(sparse, same)).toBe(true);
  });

  it('rejects a moved row, a new row, and a hole that filled in', () => {
    expect(rectsMatch([first, second], [first, box({ top: 25, height: 24, width: 200 })])).toBe(
      false,
    );
    expect(rectsMatch([first], [first, second])).toBe(false);
    const hole: (ItemRect | undefined)[] = [first, undefined];
    expect(rectsMatch(hole, [first, second])).toBe(false);
  });
});

describe('readContainerProjection', () => {
  it('derives the ancestor scale from the visual box over the layout box', () => {
    const container = laidOut(document.createElement('div'), {
      offsetWidth: 200,
      offsetHeight: 400,
      clientTop: 1,
      clientLeft: 2,
    });
    container.scrollTop = 30;
    container.scrollLeft = 10;
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 50, top: 60, width: 100, height: 800 }),
    });

    expect(readContainerProjection(container)).toEqual({
      left: 50,
      top: 60,
      scrollX: 10,
      scrollY: 30,
      borderX: 2,
      borderY: 1,
      scaleX: 0.5,
      scaleY: 2,
    });
  });

  it('assumes no scale for a container with no layout box', () => {
    const container = laidOut(document.createElement('div'), {
      offsetWidth: 0,
      offsetHeight: 0,
    });
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    });

    const projection = readContainerProjection(container);
    expect(projection.scaleX).toBe(1);
    expect(projection.scaleY).toBe(1);
  });
});

describe('projectRect', () => {
  it('carries a layout rect through scroll, border and scale', () => {
    const projection: ContainerProjection = {
      left: 50,
      top: 60,
      scrollX: 10,
      scrollY: 30,
      borderX: 2,
      borderY: 1,
      scaleX: 0.5,
      scaleY: 2,
    };

    expect(projectRect(box({ top: 130, left: 20, width: 200, height: 24 }), projection)).toEqual({
      left: 50 + (2 + 20 - 10) * 0.5,
      top: 60 + (1 + 130 - 30) * 2,
      width: 100,
      height: 48,
    });
  });
});

describe('resolveNearestIndex', () => {
  const rows = [
    box({ top: 0, height: 20, left: 0, width: 200 }),
    box({ top: 20, height: 20, left: 0, width: 200 }),
    box({ top: 40, height: 20, left: 0, width: 200 }),
  ];

  it('has nothing to activate before anything is measured', () => {
    expect(
      resolveNearestIndex({
        axis: 'y',
        rects: [],
        pointerX: 10,
        pointerY: 10,
        projection: identity,
      }),
    ).toBeNull();
  });

  it('prefers the row the pointer is inside', () => {
    expect(
      resolveNearestIndex({
        axis: 'y',
        rects: rows,
        pointerX: 5,
        pointerY: 25,
        projection: identity,
      }),
    ).toBe(1);
  });

  it('reaches the nearest row when the pointer is past the list, ignoring the other axis', () => {
    const below = {
      axis: 'y' as const,
      rects: rows,
      pointerY: 400,
      projection: identity,
    };
    expect(resolveNearestIndex({ ...below, pointerX: 5 })).toBe(2);
    // A vertical list must not care how far sideways the pointer strayed.
    expect(resolveNearestIndex({ ...below, pointerX: 9_000 })).toBe(2);
  });

  it('resolves a strip along x without regard to vertical distance', () => {
    const strip = [
      box({ left: 0, width: 40, top: 0, height: 30 }),
      box({ left: 40, width: 40, top: 0, height: 30 }),
    ];
    expect(
      resolveNearestIndex({
        axis: 'x',
        rects: strip,
        pointerX: 70,
        pointerY: 9_000,
        projection: identity,
      }),
    ).toBe(1);
  });

  it('resolves a grid across rows and columns at once', () => {
    // Two columns, two rows. A single-axis pick would tie on the top row; only
    // the Euclidean distance names the card under the cursor.
    const grid = [
      box({ left: 0, top: 0, width: 100, height: 100 }),
      box({ left: 100, top: 0, width: 100, height: 100 }),
      box({ left: 0, top: 100, width: 100, height: 100 }),
      box({ left: 100, top: 100, width: 100, height: 100 }),
    ];
    const grab = (pointerX: number, pointerY: number) =>
      resolveNearestIndex({ axis: 'xy', rects: grid, pointerX, pointerY, projection: identity });

    expect(grab(150, 150)).toBe(3);
    expect(grab(10, 190)).toBe(2);
    // Outside the grid entirely: the closest card by center still wins.
    expect(grab(400, 20)).toBe(1);
  });

  it('skips holes and disabled rows without shifting the remaining indices', () => {
    const withHole: (ItemRect | undefined)[] = [rows[0], undefined, rows[2]];
    expect(
      resolveNearestIndex({
        axis: 'y',
        rects: withHole,
        pointerX: 5,
        pointerY: 25,
        projection: identity,
      }),
    ).toBe(0);

    // A collapsed sub-tree stays registered so the measurements hold; it just
    // becomes invisible to hit-testing.
    expect(
      resolveNearestIndex({
        axis: 'y',
        rects: rows,
        pointerX: 5,
        pointerY: 25,
        projection: identity,
        isSkipped: (index) => index === 1,
      }),
    ).toBe(0);
  });

  it('hit-tests in the same visual space the pointer lives in', () => {
    const scaled: ContainerProjection = { ...identity, top: 100, scaleY: 2, scrollY: 10 };
    // Row 1 spans layout 20..40, which under this projection lands at 120..160.
    expect(
      resolveNearestIndex({
        axis: 'y',
        rects: rows,
        pointerX: 0,
        pointerY: 140,
        projection: scaled,
      }),
    ).toBe(1);
    expect(
      resolveNearestIndex({
        axis: 'y',
        rects: rows,
        pointerX: 0,
        pointerY: 25,
        projection: scaled,
      }),
    ).toBe(0);
  });
});

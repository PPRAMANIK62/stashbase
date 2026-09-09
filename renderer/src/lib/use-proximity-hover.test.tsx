import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useProximityHover, type ItemRect } from './use-proximity-hover';

// The hook coalesces every measurement and every pointer move onto a frame, so
// the test owns the frame queue and flushes it where a browser would paint.
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;

/** Runs the queued frames, then the ones they schedule, until the list has
 *  settled — a measurement pass may retry, and each retry lands a frame. */
function paint(): void {
  for (let pass = 0; pass < 10 && frames.size > 0; pass++) {
    const pending = [...frames.values()];
    frames.clear();
    act(() => {
      for (const callback of pending) callback(pass);
    });
  }
}

beforeEach(() => {
  frames.clear();
  nextFrameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrameId += 1;
    frames.set(nextFrameId, callback);
    return nextFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => void frames.delete(id));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** happy-dom computes no layout, so a row reports the box the test gives it.
 *  `offsetParent` stays null — a flat list's rows are measured straight from
 *  their own offsets — which also makes a zero-sized row correctly boxless. */
function pinRow(node: HTMLElement, rect: ItemRect): void {
  const metrics = {
    offsetParent: null,
    offsetTop: rect.top,
    offsetLeft: rect.left,
    offsetWidth: rect.width,
    offsetHeight: rect.height,
  };
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(node, name, { configurable: true, value });
  }
}

/** The container sits at the viewport origin, unscrolled and unscaled, so a
 *  row's layout box is also where the pointer finds it. */
function pinContainer(container: HTMLElement): void {
  Object.defineProperty(container, 'offsetWidth', { configurable: true, value: 200 });
  Object.defineProperty(container, 'offsetHeight', { configurable: true, value: 60 });
  Object.defineProperty(container, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 200, height: 60 }),
  });
}

type Register = (index: number, element: HTMLElement | null) => void;

/** A row and the layout box the test gives it. The id keeps React's identity
 *  independent of the registration index the hook cares about. */
interface RowFixture {
  id: string;
  rect: ItemRect;
}

/** Rows register from an effect, the way every consumer of the hook does. */
function Row({
  disabled,
  index,
  rect,
  register,
}: {
  disabled: boolean;
  index: number;
  rect: ItemRect;
  register: Register;
}) {
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    pinRow(element, rect);
    register(index, element);
    return () => register(index, null);
  }, [index, rect, register]);
  return <div data-disabled={String(disabled)} data-testid={`row-${index}`} ref={node} />;
}

function List({ rows, disabledRow }: { rows: readonly RowFixture[]; disabledRow?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const { activeIndex, isMeasured, itemRects, handlers, registerItem } = useProximityHover(
    container,
    {
      axis: 'y',
      isItemDisabled: (element) => element.dataset.disabled === 'true',
    },
  );
  return (
    <div data-testid="list" ref={container} {...handlers}>
      {rows.map((fixture, index) => (
        <Row
          disabled={index === disabledRow}
          index={index}
          key={fixture.id}
          rect={fixture.rect}
          register={registerItem}
        />
      ))}
      <span data-testid="active">{String(activeIndex)}</span>
      <span data-testid="measured">{String(isMeasured)}</span>
      <span data-testid="rects">{itemRects.length}</span>
    </div>
  );
}

const rowAt = (index: number): RowFixture => ({
  id: `fixture-${index}`,
  rect: { top: index * 20, height: 20, left: 0, width: 200 },
});
const threeRows = [rowAt(0), rowAt(1), rowAt(2)];

function renderList(props: Parameters<typeof List>[0]) {
  const view = render(<List {...props} />);
  pinContainer(view.getByTestId('list'));
  return {
    ...view,
    list: () => view.getByTestId('list'),
    active: () => view.getByTestId('active').textContent,
    measured: () => view.getByTestId('measured').textContent,
    rectCount: () => view.getByTestId('rects').textContent,
  };
}

describe('useProximityHover', () => {
  it('withholds readiness until the registered rows have been measured', () => {
    const view = renderList({ rows: threeRows });
    expect(view.measured()).toBe('false');

    paint();
    expect(view.measured()).toBe('true');
    expect(view.rectCount()).toBe('3');
  });

  it('activates the row under the pointer and releases it on leave', () => {
    const view = renderList({ rows: threeRows });
    paint();

    fireEvent.mouseEnter(view.list());
    fireEvent.mouseMove(view.list(), { clientX: 10, clientY: 25 });
    paint();
    expect(view.active()).toBe('1');

    // Past the end of the list the nearest row still leads the pointer.
    fireEvent.mouseMove(view.list(), { clientX: 10, clientY: 400 });
    paint();
    expect(view.active()).toBe('2');

    fireEvent.mouseLeave(view.list());
    expect(view.active()).toBe('null');
  });

  it('leaves a disabled row unreachable while keeping the rects stable', () => {
    const view = renderList({ rows: threeRows, disabledRow: 1 });
    paint();
    expect(view.rectCount()).toBe('3');

    fireEvent.mouseMove(view.list(), { clientX: 10, clientY: 25 });
    paint();
    expect(view.active()).toBe('0');
  });

  it('holds readiness while a row still has no layout box', () => {
    const unlaidOut: RowFixture = {
      id: 'unlaid-out',
      rect: { top: 0, height: 0, left: 0, width: 0 },
    };
    const view = renderList({ rows: [rowAt(0), unlaidOut] });
    paint();

    // The retries run out rather than publishing zeroed rects, which would pin
    // an overlay to the top of the list.
    expect(view.measured()).toBe('false');
    expect(view.rectCount()).toBe('0');
  });

  it('re-measures when the row set changes', () => {
    const view = renderList({ rows: threeRows });
    paint();
    expect(view.rectCount()).toBe('3');

    view.rerender(<List rows={[rowAt(0), rowAt(1)]} />);
    expect(view.measured()).toBe('false');

    paint();
    expect(view.rectCount()).toBe('2');
    expect(view.measured()).toBe('true');
  });
});

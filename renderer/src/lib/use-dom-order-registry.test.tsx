import { cleanup, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createDomOrderRegistry,
  useDomOrderIndex,
  useDomOrderRegistry,
  useMarkedIndex,
  type DomOrderRegistry,
} from './use-dom-order-registry';

const mounted: HTMLElement[] = [];

afterEach(() => {
  cleanup();
  for (const container of mounted.splice(0)) container.remove();
});

interface Rows {
  container: HTMLElement;
  items: HTMLElement[];
  /** The nth row, or a failure rather than an `undefined` the assertion would
   *  quietly compare against. */
  at(index: number): HTMLElement;
}

/** `count` sibling rows, in the document, in the order they were created —
 *  document position is what the registry sorts by, so the rows have to be
 *  really attached rather than detached fragments. */
function rows(count: number): Rows {
  const container = document.createElement('div');
  document.body.append(container);
  mounted.push(container);
  const items = Array.from({ length: count }, () => {
    const row = document.createElement('div');
    container.append(row);
    return row;
  });
  return {
    container,
    items,
    at(index) {
      const row = items[index];
      if (!row) throw new Error(`no row at ${index}`);
      return row;
    },
  };
}

/** Lets the registry's queued cache drop run. */
const flushMicrotasks = (): Promise<void> => Promise.resolve();

describe('createDomOrderRegistry', () => {
  it('answers -1 for an element it has never seen, and for none at all', () => {
    const registry = createDomOrderRegistry();
    const list = rows(1);

    expect(registry.indexOf(list.at(0))).toBe(-1);
    expect(registry.indexOf(null)).toBe(-1);
    expect(registry.ordered()).toEqual([]);
  });

  it('orders by document position rather than by registration order', () => {
    // The whole point of registering an ELEMENT: a conditional item that
    // mounts late would otherwise land at the end of the list forever.
    const registry = createDomOrderRegistry();
    const list = rows(3);

    registry.register(list.at(2));
    registry.register(list.at(0));
    registry.register(list.at(1));

    expect(registry.ordered()).toEqual(list.items);
    expect(registry.indexOf(list.at(1))).toBe(1);
  });

  it('renumbers around an item inserted in the middle, with no help from its neighbours', () => {
    // The bookkeeping this replaces: a caller that passed `index` had to
    // renumber every row after the insertion point itself.
    const registry = createDomOrderRegistry();
    const list = rows(2);
    registry.register(list.at(0));
    registry.register(list.at(1));
    expect(registry.indexOf(list.at(1))).toBe(1);

    const inserted = document.createElement('div');
    list.at(1).before(inserted);
    registry.register(inserted);

    expect(registry.indexOf(inserted)).toBe(1);
    expect(registry.indexOf(list.at(1))).toBe(2);
    expect(registry.ordered()).toHaveLength(3);
  });

  it('serves one cached order per render pass and drops it on the microtask boundary', async () => {
    // Two reads inside one pass have to agree — that is what
    // `useSyncExternalStore` demands of a snapshot — but the next pass must
    // not inherit an answer taken before a row moved.
    const registry = createDomOrderRegistry();
    const list = rows(2);
    registry.register(list.at(0));
    registry.register(list.at(1));

    const withinPass = registry.ordered();
    expect(withinPass).toEqual(list.items);
    list.container.prepend(list.at(1));
    expect(registry.ordered()).toBe(withinPass);

    await flushMicrotasks();
    expect(registry.ordered()).toEqual([list.at(1), list.at(0)]);
  });

  it('forgets an element once its registration is disposed', () => {
    const registry = createDomOrderRegistry();
    const list = rows(2);
    const dispose = registry.register(list.at(0));
    registry.register(list.at(1));

    dispose();

    expect(registry.ordered()).toEqual([list.at(1)]);
    expect(registry.ordered()).toHaveLength(1);
    expect(registry.indexOf(list.at(0))).toBe(-1);
    expect(registry.indexOf(list.at(1))).toBe(0);
  });

  it('keeps at most one marked item, so the newest mark replaces the old', () => {
    const registry = createDomOrderRegistry();
    const list = rows(3);
    for (const item of list.items) registry.register(item);

    registry.mark(list.at(0), true);
    expect(registry.markedIndex()).toBe(0);

    registry.mark(list.at(2), true);
    expect(registry.markedIndex()).toBe(2);

    // Clearing the newest mark has to leave nothing marked; a stale first mark
    // would surface here as index 0.
    registry.mark(list.at(2), false);
    expect(registry.markedIndex()).toBe(-1);
  });

  it('reports -1 while nothing is marked', () => {
    const registry = createDomOrderRegistry();
    const list = rows(2);
    for (const item of list.items) registry.register(item);

    expect(registry.markedIndex()).toBe(-1);
  });

  it('drops the mark when the marked element unregisters', () => {
    // A row that unmounts while chosen would otherwise leave `markedIndex`
    // pointing at whichever row inherited its position.
    const registry = createDomOrderRegistry();
    const list = rows(2);
    const dispose = registry.register(list.at(0));
    registry.register(list.at(1));
    registry.mark(list.at(0), true);

    dispose();

    expect(registry.markedIndex()).toBe(-1);
  });

  it('notifies on membership and mark changes, and not on a mark that changes nothing', () => {
    const registry = createDomOrderRegistry();
    const list = rows(1);
    const row = list.at(0);
    let notifications = 0;
    const unsubscribe = registry.subscribe(() => {
      notifications += 1;
    });

    const dispose = registry.register(row);
    expect(notifications).toBe(1);

    registry.mark(row, true);
    expect(notifications).toBe(2);

    // Re-asserting the same flag every render is the normal case; waking every
    // subscriber for it would re-render the whole list on every pass.
    registry.mark(row, true);
    expect(notifications).toBe(2);
    registry.mark(row, false);
    registry.mark(row, false);
    expect(notifications).toBe(3);

    dispose();
    expect(notifications).toBe(4);

    unsubscribe();
    registry.register(row);
    expect(notifications).toBe(4);
  });
});

interface ItemProps {
  id: string;
  registry: DomOrderRegistry;
  marked?: boolean;
  /** A row that never attaches its ref, standing in for one that renders null. */
  detached?: boolean;
}

function Item({ id, registry, marked = false, detached = false }: ItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  const index = useDomOrderIndex(ref, registry, marked);
  return <li ref={detached ? null : ref}>{`${id}:${index}`}</li>;
}

function List({
  items,
  marked,
  detached,
}: {
  items: string[];
  marked?: string;
  detached?: string;
}) {
  const registry = useDomOrderRegistry();
  const markedIndex = useMarkedIndex(registry);
  return (
    <div>
      <output data-testid="marked">{markedIndex ?? 'none'}</output>
      <ul>
        {items.map((id) => (
          <Item
            key={id}
            id={id}
            registry={registry}
            marked={id === marked}
            detached={id === detached}
          />
        ))}
      </ul>
    </div>
  );
}

const labels = (view: ReturnType<typeof render>): string[] =>
  view.getAllByRole('listitem').map((row) => row.textContent ?? '');

describe('useDomOrderIndex', () => {
  it('settles every row on its document position before the caller can read it', () => {
    const view = render(<List items={['a', 'b', 'c']} />);

    expect(labels(view)).toEqual(['a:0', 'b:1', 'c:2']);
  });

  it('renumbers the rows after an insertion without renumbering the ones before it', () => {
    const view = render(<List items={['a', 'c']} />);
    view.rerender(<List items={['a', 'b', 'c']} />);

    expect(labels(view)).toEqual(['a:0', 'b:1', 'c:2']);
  });

  it('renumbers after a removal', () => {
    const view = render(<List items={['a', 'b', 'c']} />);
    view.rerender(<List items={['a', 'c']} />);

    expect(labels(view)).toEqual(['a:0', 'c:1']);
  });

  it('leaves a row that never attaches an element at -1, without shifting its neighbours', () => {
    // The documented pre-registration value, and the reason callers gate on a
    // non-negative index instead of trusting 0. An unregistered row must not
    // occupy a position either, or every row after it would be off by one.
    const view = render(<List items={['a', 'b', 'c']} detached="b" />);

    expect(labels(view)).toEqual(['a:0', 'b:-1', 'c:1']);
  });
});

describe('useMarkedIndex', () => {
  it('reads as undefined while no row is chosen', () => {
    // The shape an overlay's props take: `undefined` means "draw nothing",
    // which -1 would not.
    const view = render(<List items={['a', 'b']} />);

    expect(view.getByTestId('marked').textContent).toBe('none');
  });

  it('follows the chosen row, including as the choice moves and clears', () => {
    const view = render(<List items={['a', 'b', 'c']} marked="c" />);
    expect(view.getByTestId('marked').textContent).toBe('2');

    view.rerender(<List items={['a', 'b', 'c']} marked="a" />);
    expect(view.getByTestId('marked').textContent).toBe('0');

    view.rerender(<List items={['a', 'b', 'c']} />);
    expect(view.getByTestId('marked').textContent).toBe('none');
  });

  it('clears when the chosen row unmounts', () => {
    const view = render(<List items={['a', 'b']} marked="b" />);
    expect(view.getByTestId('marked').textContent).toBe('1');

    view.rerender(<List items={['a']} />);
    expect(view.getByTestId('marked').textContent).toBe('none');
  });
});

describe('useDomOrderRegistry', () => {
  it('hands out one registry for the life of the list', () => {
    // A fresh registry per render would re-run every item's registration
    // effect and blank the list's indices on each pass.
    const { result, rerender } = renderHook(() => useDomOrderRegistry());
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { CommandItem, CommandList } from './command-menu';

function CommandListHarness() {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <CommandList
      activeIndex={activeIndex}
      aria-label="Documents"
      onActiveIndexChange={setActiveIndex}
      role="listbox"
    >
      <CommandItem active={activeIndex === 0} index={0}>
        First.md
      </CommandItem>
      <CommandItem active={activeIndex === 1} index={1}>
        Second.md
      </CommandItem>
    </CommandList>
  );
}

function setBox(
  element: HTMLElement,
  box: { height: number; left?: number; top?: number; width: number },
  offsetParent: HTMLElement | null,
) {
  const left = box.left ?? 0;
  const top = box.top ?? 0;
  Object.defineProperties(element, {
    offsetHeight: { configurable: true, value: box.height },
    offsetLeft: { configurable: true, value: left },
    offsetParent: { configurable: true, value: offsetParent },
    offsetTop: { configurable: true, value: top },
    offsetWidth: { configurable: true, value: box.width },
  });
  element.getBoundingClientRect = () =>
    ({
      bottom: top + box.height,
      height: box.height,
      left,
      right: left + box.width,
      top,
      width: box.width,
      x: left,
      y: top,
      toJSON: () => undefined,
    }) as DOMRect;
}

afterEach(cleanup);

describe('CommandList', () => {
  it('uses pointer proximity to move the active option', async () => {
    render(<CommandListHarness />);
    const list = screen.getByRole('listbox', { name: 'Documents' });
    const [first, second] = screen.getAllByRole('option');
    setBox(list, { height: 72, width: 240 }, null);
    setBox(first!, { height: 36, top: 0, width: 240 }, list);
    setBox(second!, { height: 36, top: 36, width: 240 }, list);

    fireEvent.mouseEnter(list);
    fireEvent.mouseMove(list, { clientX: 20, clientY: 54 });

    await waitFor(() => expect(second?.getAttribute('aria-selected')).toBe('true'));
    expect(first?.getAttribute('aria-selected')).toBe('false');
  });
});

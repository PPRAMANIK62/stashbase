import { act, render, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useStickToBottom } from './use-stick-to-bottom';

function Log({ conversation }: { conversation: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { atBottom, scrollToBottom } = useStickToBottom(ref, conversation);
  return (
    <>
      <div data-testid="log" ref={ref}>
        <div>{conversation}</div>
      </div>
      {!atBottom && <button onClick={scrollToBottom}>Back to latest</button>}
    </>
  );
}

let grow: () => void = () => undefined;

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        grow = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function measure(element: HTMLElement) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 1_000 });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 300 });
}

describe('useStickToBottom', () => {
  it('opens at the end, holds still after the reader scrolls up, and re-pins for a new key', () => {
    const view = render(<Log conversation="a" />);
    const log = view.getByTestId('log');
    measure(log);
    act(() => grow());
    expect(log.scrollTop).toBe(1_000);

    log.scrollTop = 100;
    fireEvent.scroll(log);
    act(() => grow());
    expect(log.scrollTop).toBe(100);

    fireEvent.click(view.getByRole('button', { name: 'Back to latest' }));
    expect(log.scrollTop).toBe(1_000);
    expect(view.queryByRole('button', { name: 'Back to latest' })).toBeNull();
    view.rerender(<Log conversation="b" />);
    expect(log.scrollTop).toBe(1_000);
  });
});

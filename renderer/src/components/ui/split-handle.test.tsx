import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { SplitHandle } from './split-handle';

afterEach(cleanup);

function renderHandle(onWidthChange = vi.fn()) {
  render(
    <SplitHandle
      defaultWidth={576}
      label="Resize Agent pane"
      max={960}
      min={320}
      onWidthChange={onWidthChange}
      pane="right"
      width={500}
    />,
  );
  return { handle: screen.getByRole('separator', { name: 'Resize Agent pane' }), onWidthChange };
}

describe('SplitHandle', () => {
  it('reports a clamped width while dragging a right-hand pane', () => {
    const { handle, onWidthChange } = renderHandle();
    fireEvent.pointerDown(handle, { clientX: 700, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 660, pointerId: 1 });
    expect(onWidthChange).toHaveBeenLastCalledWith(540);
    fireEvent.pointerMove(handle, { clientX: 1_500, pointerId: 1 });
    expect(onWidthChange).toHaveBeenLastCalledWith(320);
    fireEvent.pointerUp(handle, { clientX: 1_500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });
    expect(onWidthChange).toHaveBeenCalledTimes(2);
  });

  it('resizes by arrow keys and resets on double-click', () => {
    const { handle, onWidthChange } = renderHandle();
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onWidthChange).toHaveBeenLastCalledWith(516);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onWidthChange).toHaveBeenLastCalledWith(484);
    fireEvent.doubleClick(handle);
    expect(onWidthChange).toHaveBeenLastCalledWith(576);
    expect(handle.getAttribute('aria-valuenow')).toBe('500');
  });
});

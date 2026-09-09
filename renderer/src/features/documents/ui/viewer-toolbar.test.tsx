import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';
import { pressKey } from '@/test/dom';

import { ViewerToolbar, ViewerToolbarValue } from './viewer-toolbar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('viewer toolbar value', () => {
  it('exposes the floating controls as one labelled toolbar', async () => {
    const { container } = render(<ViewerToolbar label="Viewer controls">Controls</ViewerToolbar>);

    const toolbar = screen.getByRole('toolbar', { name: 'Viewer controls' });
    expect(toolbar.textContent).toBe('Controls');
    await expectNoA11yViolations(container);
  });

  it('resets zoom on a single click and edits it in place on a double-click', () => {
    vi.useFakeTimers();
    const reset = vi.fn();
    const commit = vi.fn();
    render(
      <ViewerToolbarValue
        label="Zoom percentage"
        max={300}
        min={50}
        onCommit={commit}
        onSingleClick={reset}
        suffix="%"
        title="Actual size; double-click to set zoom"
        value={227}
      />,
    );

    const value = screen.getByRole('button', { name: 'Zoom percentage' });
    fireEvent.click(value, { detail: 1 });
    vi.advanceTimersByTime(239);
    expect(reset).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reset).toHaveBeenCalledOnce();

    reset.mockClear();
    fireEvent.click(value, { detail: 1 });
    fireEvent.doubleClick(value);
    vi.advanceTimersByTime(240);
    expect(reset).not.toHaveBeenCalled();

    const input = screen.getByRole('textbox', { name: 'Zoom percentage' });
    expect(input.getAttribute('value')).toBe('227');
    expect(input.style.width).toBe('3ch');
    fireEvent.change(input, { target: { value: '75' } });
    expect(input.style.width).toBe('2ch');
    pressKey(input, 'Enter');
    expect(commit).toHaveBeenCalledWith(75);
  });

  it('opens the page input immediately without selecting its contents', () => {
    const commit = vi.fn();
    render(
      <ViewerToolbarValue
        align="end"
        editOnClick
        emphasis="default"
        label="Page number"
        max={535}
        min={1}
        onCommit={commit}
        style={{ width: 'calc(3ch + 0.75rem)' }}
        title="Go to page"
        value={53}
      />,
    );

    const pageButton = screen.getByRole('button', { name: 'Page number' });
    expect(pageButton.style.width).toBe('calc(3ch + 0.75rem)');
    fireEvent.click(pageButton);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Page number' });
    expect(input.style.width).toBe('');
    expect(input.parentElement?.style.width).toBe('calc(3ch + 0.75rem)');
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);

    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);
    expect(commit).toHaveBeenCalledWith(120);
  });
});

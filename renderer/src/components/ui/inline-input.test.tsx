import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { InlineInput } from './inline-input';

afterEach(cleanup);

describe('InlineInput', () => {
  it('commits on Enter and cancels on Escape', async () => {
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    const onChange = vi.fn();
    const view = render(
      <InlineInput
        aria-label="File name"
        onCancel={onCancel}
        onChange={onChange}
        onCommit={onCommit}
        value="quarterly-report.md"
      />,
    );
    const field = screen.getByRole('textbox', { name: 'File name' });
    fireEvent.change(field, { target: { value: 'q1-report.md' } });
    expect(onChange).toHaveBeenLastCalledWith('q1-report.md');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(view.container);
  });

  it('pre-selects the requested run when it takes focus on mount', () => {
    render(
      <InlineInput
        aria-label="File name"
        focusOnMount
        onCancel={vi.fn()}
        onChange={vi.fn()}
        onCommit={vi.fn()}
        selection={{ end: 16, start: 0 }}
        value="quarterly-report.md"
      />,
    );
    const field = screen.getByRole('textbox', { name: 'File name' });
    if (!(field instanceof HTMLInputElement)) throw new Error('InlineInput renders an <input>.');
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 16]);
  });
});

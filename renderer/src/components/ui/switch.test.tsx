import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Switch } from './switch';

afterEach(cleanup);

describe('Switch', () => {
  it('toggles once per press, from the control or from its label', async () => {
    const onToggle = vi.fn();
    const view = render(
      <Switch checked={false} label="Index new documents automatically" onToggle={onToggle} />,
    );
    const control = screen.getByRole('switch', { name: 'Index new documents automatically' });
    expect(control.getAttribute('aria-checked')).toBe('false');

    // The control's own activation and the widened pointer target around it
    // must not both fire: the click on the control bubbles to the wrapper,
    // and counting it twice would leave the setting exactly where it was.
    fireEvent.click(control);
    expect(onToggle).toHaveBeenCalledTimes(1);

    const wrapper = view.container.querySelector('[role="presentation"]');
    if (!wrapper) throw new Error('Switch renders a presentational wrapper.');
    fireEvent.click(wrapper);
    expect(onToggle).toHaveBeenCalledTimes(2);

    await expectNoA11yViolations(view.container);
  });

  it('keeps its accessible name when the label is visually hidden', async () => {
    const view = render(
      <Switch checked labelHidden label="Follow the system theme" onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('switch', { name: 'Follow the system theme' })).toBeDefined();
    await expectNoA11yViolations(view.container);
  });
});

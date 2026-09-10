import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Button } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('calls its handler and stays accessible across the variants', async () => {
    const onClick = vi.fn();
    const view = render(
      <div>
        <Button onClick={onClick} variant="primary">
          Save changes
        </Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="ghost">Ghost</Button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(view.container);
  });

  it('gives an icon-only button its name from aria-label', async () => {
    const view = render(
      <Button aria-label="Add project" size="icon" variant="tertiary">
        <svg aria-hidden="true" viewBox="0 0 16 16" />
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
    await expectNoA11yViolations(view.container);
  });
});

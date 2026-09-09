import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Kbd } from './kbd';

afterEach(cleanup);

describe('Kbd', () => {
  it('renders each cap as a <kbd> element', async () => {
    const view = render(
      <span>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd> opens the command menu
      </span>,
    );
    // The tag is what assistive technology announces as a keystroke, so the
    // element this primitive emits is the assertion, not a detail behind one.
    expect(view.container.querySelectorAll('kbd')).toHaveLength(2); // dom-contract: <kbd>
    expect(screen.getByText('⌘')).toBeDefined();
    await expectNoA11yViolations(view.container);
  });

  it('keeps the inverted face readable on a foreground surface', async () => {
    const view = render(
      <span className="bg-foreground text-background">
        <Kbd variant="inverted">[</Kbd> toggles the sidebar
      </span>,
    );
    await expectNoA11yViolations(view.container);
  });
});

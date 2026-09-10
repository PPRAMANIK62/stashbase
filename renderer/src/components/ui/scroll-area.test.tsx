import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { ScrollArea } from './scroll-area';

afterEach(cleanup);

describe('ScrollArea', () => {
  it('scrolls its content on the viewport, not the outer box', async () => {
    const view = render(
      <ScrollArea className="h-32 w-64" viewportClassName="scroll-fade">
        <ul>
          <li>v2.3.0</li>
          <li>v2.2.0</li>
        </ul>
      </ScrollArea>,
    );
    const viewport = view.container.querySelector('[data-slot="scroll-area-viewport"]');
    expect(viewport?.className).toContain('scroll-fade');
    expect(screen.getByText('v2.3.0')).toBeDefined();
    await expectNoA11yViolations(view.container);
  });

  it('offers both axes when asked for them', async () => {
    const view = render(
      <ScrollArea className="size-64" orientation="both">
        <div>Wide and tall content</div>
      </ScrollArea>,
    );
    await expectNoA11yViolations(view.container);
  });
});

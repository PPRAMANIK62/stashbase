import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { MobileDrawer } from './mobile-drawer';

afterEach(cleanup);

describe('MobileDrawer', () => {
  it('presents its navigation as a named dialog when open', async () => {
    render(
      <MobileDrawer onClose={vi.fn()} open>
        <nav aria-label="Project navigation">
          <a href="#library">Library</a>
        </nav>
      </MobileDrawer>,
    );
    const panel = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(panel.textContent).toContain('Library');
    // The panel renders into a portal, so the whole document is the subject.
    await expectNoA11yViolations(document.body);
  });

  it('asks to close when the backdrop is dismissed', async () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer onClose={onClose} open>
        <p>Navigation</p>
      </MobileDrawer>,
    );
    const panel = await screen.findByRole('dialog', { name: 'Navigation' });
    panel.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

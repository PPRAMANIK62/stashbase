import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Button } from './button';
import { Tooltip, TooltipProvider } from './tooltip';

afterEach(cleanup);

describe('Tooltip', () => {
  it('shows its content while forced open, without hiding the trigger', async () => {
    render(
      <TooltipProvider>
        <Tooltip content="Open search" forceOpen side="right">
          <Button variant="secondary">Search</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: /Search/ })).toBeDefined();
    expect(await screen.findByText('Open search')).toBeDefined();
    // The popup renders into a portal, so the whole document is the subject.
    await expectNoA11yViolations(document.body);
  });

  it('stays closed until asked, and works without an ambient provider', async () => {
    const view = render(
      <Tooltip content="Rename document">
        <Button variant="ghost">Rename</Button>
      </Tooltip>,
    );
    expect(screen.queryByText('Rename document')).toBeNull();
    await expectNoA11yViolations(view.container);
  });
});

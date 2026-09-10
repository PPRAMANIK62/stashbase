import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { TreeDisclosure } from './tree-disclosure';

afterEach(cleanup);

describe('TreeDisclosure', () => {
  it('collapses and re-expands its branch from the trigger', async () => {
    const view = render(
      <TreeDisclosure label="design-docs">
        <div>overview.md</div>
      </TreeDisclosure>,
    );
    const trigger = screen.getByRole('button', { name: 'design-docs' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await expectNoA11yViolations(view.container);
  });
});

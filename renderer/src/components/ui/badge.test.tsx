import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Badge } from './badge';

afterEach(cleanup);

describe('Badge', () => {
  it('labels a status without violating accessibility rules', async () => {
    const view = render(
      <p>
        Indexing is <Badge color="green">Ready</Badge>
      </p>,
    );
    expect(screen.getByText('Ready')).toBeDefined();
    await expectNoA11yViolations(view.container);
  });

  it('renders the dot variant as decoration, not as content', async () => {
    const view = render(<Badge variant="dot">Preparing</Badge>);
    // The dot is a coloured square with no text; the label carries the meaning,
    // so a screen reader reads "Preparing" and nothing else.
    expect(view.container.textContent).toBe('Preparing');
    await expectNoA11yViolations(view.container);
  });
});

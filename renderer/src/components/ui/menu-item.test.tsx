import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Button } from './button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from './dropdown';
import { MenuItem } from './menu-item';

afterEach(cleanup);

/** Rows exist only inside a surface, which is what supplies the primitive they
 *  wrap themselves in. */
function openMenu(children: ReactNode) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownTrigger render={<Button variant="secondary">Open</Button>} />
      <DropdownContent aria-label="Menu">{children}</DropdownContent>
    </DropdownMenu>
  );
}

/** The index each row ended up with, read off the attribute the proximity
 *  overlays and the popup primitive both key on. Queried from the popup rather
 *  than by role, because a list may hold `menuitem` and `menuitemradio` rows
 *  at once and their order together is what is under test. */
function indices(): (string | null)[] {
  const rows = screen.getByRole('menu').querySelectorAll('[data-proximity-index]');
  return [...rows].map((row) => row.getAttribute('data-proximity-index'));
}

describe('MenuItem row numbering', () => {
  it('numbers rows by DOM order when no index is passed', async () => {
    render(
      openMenu(
        <>
          <MenuItem label="Rename" />
          <MenuItem label="Duplicate" />
          <MenuItem label="Delete" />
        </>,
      ),
    );

    expect(indices()).toEqual(['0', '1', '2']);
    await expectNoA11yViolations(screen.getByRole('menu'));
  });

  it('numbers a row inserted in the middle without renumbering its caller', () => {
    // The point of DOM-order registration: the list around the new row is
    // written exactly as before, and every row after it still moves up one.
    const view = render(
      openMenu(
        <>
          <MenuItem label="First" />
          <MenuItem label="Third" />
        </>,
      ),
    );
    expect(indices()).toEqual(['0', '1']);

    view.rerender(
      openMenu(
        <>
          <MenuItem label="First" />
          <MenuItem label="Second" />
          <MenuItem label="Third" />
        </>,
      ),
    );

    expect(indices()).toEqual(['0', '1', '2']);
  });

  it('renumbers the rows after one that is removed', () => {
    const view = render(
      openMenu(
        <>
          <MenuItem label="First" />
          <MenuItem key="middle" label="Middle" />
          <MenuItem label="Last" />
        </>,
      ),
    );
    expect(indices()).toEqual(['0', '1', '2']);

    view.rerender(
      openMenu(
        <>
          <MenuItem label="First" />
          <MenuItem label="Last" />
        </>,
      ),
    );

    expect(indices()).toEqual(['0', '1']);
  });

  it('announces the checked row as the chosen radio option', () => {
    render(
      openMenu(
        <>
          <MenuItem checked={false} label="Newest first" />
          <MenuItem checked label="Oldest first" />
          <MenuItem checked={false} label="Recently opened" />
        </>,
      ),
    );

    const rows = screen.getAllByRole('menuitemradio');
    // The checked row marks itself, and the surface finds it through the same
    // derived indices the rows above are numbered by.
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(indices()).toEqual(['0', '1', '2']);
  });
});

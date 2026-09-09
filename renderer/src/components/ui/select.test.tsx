import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Select, SelectContent, SelectItem, SelectTrigger, type SelectOption } from './select';

afterEach(cleanup);

const OPTIONS: SelectOption[] = [
  { value: 'project', label: 'Current project' },
  { value: 'workspace', label: 'Entire workspace' },
];

/** The popup renders only while it is open, so every assertion below is made
 *  against a Select that has never been opened — which is the whole point of
 *  resolving the trigger's label from a list rather than from the rows. */
function trigger(): HTMLElement {
  return screen.getByRole('combobox');
}

describe('Select trigger label', () => {
  it('names the current value from `items` before the popup has mounted', async () => {
    const view = render(
      <Select items={OPTIONS} value="workspace">
        <SelectTrigger placeholder="Choose scope" />
        <SelectContent>
          {/* Deliberately different text: the trigger names the value from
              `items`, never from the row that happens to carry it. */}
          <SelectItem value="project">row project</SelectItem>
          <SelectItem value="workspace">row workspace</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger().textContent).toContain('Entire workspace');
    await expectNoA11yViolations(view.container);
  });

  it('names the current value from an element label', () => {
    // The reason `items` carries a ReactNode: a label that is markup has to
    // reach the trigger intact rather than degrading to the raw value.
    const decorated: SelectOption[] = [{ value: 'workspace', label: <em>Entire workspace</em> }];

    render(
      <Select items={decorated} value="workspace">
        <SelectTrigger placeholder="Choose scope" />
        <SelectContent>
          <SelectItem value="workspace">
            <em>Entire workspace</em>
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger().textContent).toContain('Entire workspace');
    expect(trigger().querySelector('em')).not.toBeNull();
  });

  it('shows the placeholder when nothing is selected', () => {
    render(
      <Select items={OPTIONS}>
        <SelectTrigger placeholder="Choose scope" />
        <SelectContent>
          <SelectItem value="project">Current project</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(trigger().textContent).toContain('Choose scope');
  });

  it('names an unlabelled trigger after its placeholder, and defers to a caller name', () => {
    // A combobox is not named by its contents, so the trigger has to carry a
    // name of its own — but only where the caller has not supplied one.
    const { rerender } = render(
      <Select items={OPTIONS} value="project">
        <SelectTrigger placeholder="Choose scope" />
        <SelectContent>
          <SelectItem value="project">Current project</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(trigger().getAttribute('aria-label')).toBe('Choose scope');

    rerender(
      <Select items={OPTIONS} value="project">
        <SelectTrigger aria-label="Search scope" placeholder="Choose scope" />
        <SelectContent>
          <SelectItem value="project">Current project</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(trigger().getAttribute('aria-label')).toBe('Search scope');

    // An `id` means a `<label for>` may name it; the placeholder must not
    // override that.
    rerender(
      <Select items={OPTIONS} value="project">
        <SelectTrigger id="scope" placeholder="Choose scope" />
        <SelectContent>
          <SelectItem value="project">Current project</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(trigger().getAttribute('aria-label')).toBeNull();
  });
});

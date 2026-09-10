import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  ChoiceList,
  ChoiceRow,
  Disclosure,
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from './rows';

afterEach(cleanup);

describe('settings row grammar', () => {
  it('titles a group so the section is reachable by its own heading', () => {
    render(
      <SettingsPane lede="What this pane is for." title="General">
        <SettingsGroup count="1 of 3 installed" title="Knowledge capture">
          <SettingsList>
            <SettingsRow title="A row" />
          </SettingsList>
        </SettingsGroup>
      </SettingsPane>,
    );

    const group = screen.getByRole('region', { name: /Knowledge capture/u });
    expect(within(group).getByText('1 of 3 installed')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'General' })).not.toBeNull();
    expect(screen.getByText('What this pane is for.')).not.toBeNull();
  });

  it('lets a row carry the label so its trailing control needs none of its own', async () => {
    const onClick = vi.fn();
    render(
      <SettingsList>
        <SettingsRow
          detail="What the switch changes."
          title="Offer to add screenshots"
          trail={
            <button onClick={onClick} type="button">
              Change
            </button>
          }
        />
      </SettingsList>,
    );

    expect(screen.getByText('Offer to add screenshots')).not.toBeNull();
    expect(screen.getByText('What the switch changes.')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Change' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders a list as a real list when asked, so its rows count as items', () => {
    render(
      <SettingsList as="ul">
        <SettingsRow as="li" title="First" />
        <SettingsRow as="li" title="Second" />
      </SettingsList>,
    );

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('makes each choice a whole row, selectable by click and by keyboard', async () => {
    const onValueChange = vi.fn();
    render(
      <ChoiceList aria-label="Source" onValueChange={onValueChange} value="a">
        <ChoiceRow checked label="Account" onSelect={() => onValueChange('a')} value="a" />
        <ChoiceRow checked={false} label="Key" onSelect={() => onValueChange('b')} value="b" />
      </ChoiceList>,
    );
    const user = userEvent.setup();
    const group = screen.getByRole('radiogroup', { name: 'Source' });
    const rows = within(group).getAllByRole('radio');

    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    await user.click(within(group).getByRole('radio', { name: 'Key' }));
    expect(onValueChange).toHaveBeenCalledWith('b');

    onValueChange.mockClear();
    await user.click(within(group).getByRole('radio', { name: 'Account' }));
    await user.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('keeps the checked row as the group tab stop, or the first row when none is', () => {
    render(
      <ChoiceList aria-label="Source" onValueChange={vi.fn()} value="b">
        <ChoiceRow checked={false} label="Account" onSelect={vi.fn()} value="a" />
        <ChoiceRow checked label="Key" onSelect={vi.fn()} value="b" />
      </ChoiceList>,
    );
    expect(screen.getAllByRole('radio').map((row) => row.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
    ]);

    cleanup();
    render(
      <ChoiceList aria-label="Source" onValueChange={vi.fn()} value={null}>
        <ChoiceRow checked={false} firstTabStop label="Account" onSelect={vi.fn()} value="a" />
        <ChoiceRow checked={false} label="Key" onSelect={vi.fn()} value="b" />
      </ChoiceList>,
    );
    expect(screen.getAllByRole('radio').map((row) => row.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
    ]);
  });

  it('leaves a control inside a choice row to its own handler, not the row selection', async () => {
    const onSelect = vi.fn();
    const onTrail = vi.fn();
    render(
      <ChoiceList aria-label="Source" onValueChange={vi.fn()} value="a">
        <ChoiceRow
          checked
          label="Account"
          onSelect={onSelect}
          trail={
            <button onClick={onTrail} type="button">
              Sign out
            </button>
          }
          value="a"
        />
      </ChoiceList>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));

    expect(onTrail).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hides disclosure content until the reader opens it', async () => {
    render(
      <Disclosure summary="Advanced">
        <p>Rarely needed detail.</p>
      </Disclosure>,
    );

    expect(screen.getByText('Rarely needed detail.').closest('details')?.open).toBe(false);
    await userEvent.setup().click(screen.getByText('Advanced'));
    expect(screen.getByText('Rarely needed detail.').closest('details')?.open).toBe(true);
  });
});

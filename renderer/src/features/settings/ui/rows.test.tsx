import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Disclosure, SettingsGroup, SettingsList, SettingsPane, SettingsRow } from './rows';

afterEach(cleanup);

describe('settings row grammar', () => {
  it('titles a group so the section is reachable by its own heading', () => {
    render(
      <SettingsPane lede="What this pane is for." title="General">
        <SettingsGroup count="1 of 3 installed" title="Preferences">
          <SettingsList>
            <SettingsRow title="A row" />
          </SettingsList>
        </SettingsGroup>
      </SettingsPane>,
    );

    const group = screen.getByRole('region', { name: /Preferences/u });
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

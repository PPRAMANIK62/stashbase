import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Bot, Settings as SettingsIcon } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { SettingsShell, type SettingsSectionDef } from './shell';

const sections: SettingsSectionDef[] = [
  { available: false, icon: SettingsIcon, id: 'general', label: 'General' },
  {
    available: true,
    icon: Bot,
    id: 'agents',
    label: 'Agents',
    render: () => <p>Agent runtimes content</p>,
  },
];

let getAnimationsDescriptor: PropertyDescriptor | undefined;

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

describe('SettingsShell', () => {
  it('renders the active section and disables an unavailable one with a Soon tag', async () => {
    render(
      <SettingsShell
        onClose={vi.fn()}
        onSectionChange={vi.fn()}
        open
        section="agents"
        sections={sections}
      />,
    );

    expect(await screen.findByText('Agent runtimes content')).not.toBeNull();
    expect(screen.getByRole('navigation').className).not.toContain('bg-surface');
    expect(screen.getByRole('dialog').className).toContain('bg-surface-2');
    const generalItem = screen.getByRole('button', { name: /General/ });
    expect(generalItem).toHaveProperty('disabled', true);
    expect(screen.getByText('Soon')).not.toBeNull();
  });

  it('switches sections through the wide-window nav rail', async () => {
    const onSectionChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SettingsShell
        onClose={vi.fn()}
        onSectionChange={onSectionChange}
        open
        section="agents"
        sections={sections}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Agents' }));
    expect(onSectionChange).toHaveBeenCalledWith('agents');
  });

  it('collapses the rail into a drawer below the compact window breakpoint', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    render(
      <SettingsShell
        onClose={vi.fn()}
        onSectionChange={vi.fn()}
        open
        section="agents"
        sections={sections}
      />,
    );

    expect(screen.queryByRole('navigation')).toBeNull();
    const openSectionsButton = screen.getByRole('button', { name: 'Open sections' });
    await user.click(openSectionsButton);
    expect(await screen.findByRole('button', { name: 'Agents' })).not.toBeNull();
  });

  it('closes on outside dismissal', async () => {
    const onClose = vi.fn();
    render(
      <SettingsShell
        onClose={onClose}
        onSectionChange={vi.fn()}
        open
        section="agents"
        sections={sections}
      />,
    );

    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

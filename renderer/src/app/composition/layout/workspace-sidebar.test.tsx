import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Providers } from '@/app/providers';
import { App } from '@/app/shell';
import { appDependencies } from '@/test/fakes/app';

afterEach(cleanup);

const LAZY = { timeout: 10_000 };

describe('bug-report entry', () => {
  it('lives in Settings rather than the sidebar and asks main to open the review', async () => {
    const open = vi.fn(async () => ({ ok: true as const }));
    render(
      <Providers>
        <App dependencies={appDependencies({ bugReport: { open } })} />
      </Providers>,
    );

    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Settings' });
    expect(screen.queryByRole('button', { name: /Report a bug/u })).toBeNull();

    // Settings is a lazy surface that opens on Agents, so the chunk is
    // fetched on the first open and General is one nav click away.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('button', { name: 'General' }, LAZY));
    await user.click(await screen.findByRole('button', { name: 'Report a bug' }, LAZY));
    expect(open).toHaveBeenCalledOnce();
  });

  it('stays visible but disabled outside the desktop app', async () => {
    render(
      <Providers>
        <App dependencies={appDependencies()} />
      </Providers>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('button', { name: 'General' }, LAZY));
    const entry = await screen.findByRole('button', { name: 'Report a bug' }, LAZY);
    expect(entry.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Available in the desktop app.')).not.toBeNull();
  });
});

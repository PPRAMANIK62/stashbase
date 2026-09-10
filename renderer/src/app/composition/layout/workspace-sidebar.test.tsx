import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Providers } from '@/app/providers';
import { App } from '@/app/shell';
import { appDependencies } from '@/test/fakes/app';

afterEach(cleanup);

describe('workspace sidebar bug-report entry', () => {
  it('asks main to open the review when the desktop offers it', async () => {
    const open = vi.fn(async () => ({ ok: true as const }));
    render(
      <Providers>
        <App dependencies={appDependencies({ bugReport: { open } })} />
      </Providers>,
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Report a bug' }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('stays visible but disabled outside the desktop app', async () => {
    render(
      <Providers>
        <App dependencies={appDependencies()} />
      </Providers>,
    );

    const entry = await screen.findByRole('button', { name: 'Report a bug (desktop app only)' });
    expect(entry.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Report a bug' })).toBeNull();
  });
});

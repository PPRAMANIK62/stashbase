import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Providers } from '@/app/providers';
import { App } from '@/app/shell';
import { appDependencies } from '@/test/fakes/app';
import { accountPort, SIGNED_IN_ACCOUNT } from '@/test/fakes/settings';
import { filesApi, workspaceAdapters } from '@/test/fakes/workspace';

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

describe('account row', () => {
  it('sits at the foot of the sidebar and starts the browser sign-in in one click', async () => {
    const account = accountPort();
    const openExternal = vi.fn(async () => true);
    const base = appDependencies();
    render(
      <Providers>
        <App
          dependencies={appDependencies({
            documents: { ...base.documents, openExternal },
            settings: { ...base.settings, accountApi: account },
          })}
        />
      </Providers>,
    );

    const signIn = await screen.findByRole('button', { name: 'Sign in' });
    await userEvent.setup().click(signIn);

    await waitFor(() => expect(account.startSignIn).toHaveBeenCalledOnce());
    expect(openExternal).toHaveBeenCalledWith('https://accounts.example/sign-in');
    expect(await screen.findByRole('button', { name: 'Waiting for browser…' })).not.toBeNull();
  });

  it('names the signed-in person and offers the credits and sign-out from a menu', async () => {
    const account = accountPort(SIGNED_IN_ACCOUNT);
    const base = appDependencies();
    render(
      <Providers>
        <App
          dependencies={appDependencies({
            settings: { ...base.settings, accountApi: account },
          })}
        />
      </Providers>,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Account: Ada Lovelace' }));
    const menu = await screen.findByRole('menu');
    // The menu opens with the person as the initials disc — never a
    // provider picture — beside the name and email.
    expect(within(menu).getByText('AL')).not.toBeNull();
    expect(within(menu).getByText('ada@example.com')).not.toBeNull();
    expect(within(menu).getByText('OpenQuill credits')).not.toBeNull();
    expect(await within(menu).findByText('100%')).not.toBeNull();
    // Settings and sign-out are the only actions in the menu.
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
    expect(within(menu).getByRole('menuitem', { name: 'Settings' })).not.toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).not.toBeNull();

    await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(account.signOut).toHaveBeenCalledOnce());
    expect(await screen.findByRole('button', { name: 'Sign in' })).not.toBeNull();
  });
});

describe('titlebar band', () => {
  it('carries the document history and New draft, and no chat controls', async () => {
    const files = filesApi({
      createEntry: vi.fn(async (_folder, _kind, parent, name) => ({
        path: parent ? `${parent}/${name}` : name,
      })),
    });
    const adapters = workspaceAdapters({ files });
    render(
      <Providers>
        <App
          dependencies={appDependencies({
            workspace: { adapters, revealLabel: 'Show in file manager' },
          })}
        />
      </Providers>,
    );

    const newDraft = await screen.findByRole('button', { name: 'New draft' });
    const back = await screen.findByRole<HTMLButtonElement>('button', { name: 'Back' });
    expect(back.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Forward' }).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Previous chat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next chat' })).toBeNull();

    // New draft makes Untitled.md at the root while nothing is selected and
    // opens it at once as a kept tab.
    await userEvent.setup().click(newDraft);
    expect(await screen.findByRole('tab', { name: 'Untitled.md' }, LAZY)).not.toBeNull();
    expect(files.createEntry).toHaveBeenCalledWith(
      expect.any(String),
      'file',
      '',
      'Untitled.md',
      expect.any(AbortSignal),
    );
  });
});

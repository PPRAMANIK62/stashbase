import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Providers } from '@/app/providers';
import { App } from '@/app/shell';
import { appDependencies } from '@/test/fakes/app';
import { libraryApi, librarySnapshot, workspaceAdapters } from '@/test/fakes/workspace';

afterEach(cleanup);

describe('workspace titlebar', () => {
  it('says Welcome while no folder is open instead of naming the hidden chat', async () => {
    const adapters = workspaceAdapters({
      library: libraryApi({
        load: vi.fn(async () => librarySnapshot({ activeFolder: null, members: [] })),
      }),
    });
    render(
      <Providers>
        <App
          dependencies={appDependencies({
            workspace: { adapters, revealLabel: 'Show in file manager' },
          })}
        />
      </Providers>,
    );

    expect(await screen.findByText('Welcome')).not.toBeNull();
    expect(screen.queryByText('New chat')).toBeNull();
  });

  it('leaves the slot to the Chat pane once a folder is open', async () => {
    render(
      <Providers>
        <App dependencies={appDependencies()} />
      </Providers>,
    );

    // The Chat pane's own header labels itself "<title>, <runtime>"; the
    // new-chat button's label has no comma, so the pattern reaches only it.
    // A blank chat's name is a heading, not yet a rename control.
    expect(await screen.findByRole('heading', { name: /^New chat, / })).not.toBeNull();
    // The slot starts on Welcome while the library is still loading, and the
    // word leaves through its exit fade rather than in the same frame.
    await waitFor(() => expect(screen.queryByText('Welcome')).toBeNull());
  });

  it("takes the chat's name away with the hidden panel and brings it back with it", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <App dependencies={appDependencies()} />
      </Providers>,
    );

    const chatName = /^New chat, /;
    expect(await screen.findByRole('heading', { name: chatName })).not.toBeNull();
    const hide = screen.getByRole('button', { name: 'Hide chat panel' });
    expect(hide.getAttribute('aria-expanded')).toBe('true');

    await user.click(hide);
    const show = screen.getByRole('button', { name: 'Show chat panel' });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    // The name lives in the pane, so hiding the pane hides the name.
    await waitFor(() => expect(screen.queryByRole('heading', { name: chatName })).toBeNull());
    expect(screen.queryByText('Welcome')).toBeNull();

    await user.click(show);
    expect(await screen.findByRole('heading', { name: chatName })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Hide chat panel' })).not.toBeNull();
  });
});

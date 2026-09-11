import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

  it('hands the slot to the active chat once a folder is open', async () => {
    render(
      <Providers>
        <App dependencies={appDependencies()} />
      </Providers>,
    );

    expect((await screen.findAllByText('New chat')).length).toBeGreaterThan(0);
    // The slot starts on Welcome while the library is still loading, and the
    // word leaves through its exit fade rather than in the same frame.
    await waitFor(() => expect(screen.queryByText('Welcome')).toBeNull());
  });
});

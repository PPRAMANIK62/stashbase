import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createRecoveryRuntime } from '@/features/documents/application/recovery-runtime';
import { recoveryApi } from '@/test/fakes/documents';

import { RecoveryDrafts } from './recovery-drafts';

const folderPath = '/library/notes';

function runtimeWith(drafts: Array<{ currentVersion: string | null; path: string }>) {
  const api = recoveryApi({
    list: vi.fn(async () => ({
      available: true as const,
      drafts: drafts.map((draft, index) => ({
        currentVersion: draft.currentVersion,
        expectedVersion: 'v1',
        savedAt: `2026-09-10T08:0${index}:00.000Z`,
        source: { folderPath, path: draft.path },
      })),
    })),
    read: vi.fn(async (source) => ({
      content: '# Draft',
      currentVersion: 'v1',
      expectedVersion: 'v1',
      savedAt: '2026-09-10T08:00:00.000Z',
      source,
    })),
  });
  const restoreInto = vi.fn(async () => 'restored' as const);
  const runtime = createRecoveryRuntime({ api, folderPath, restoreInto });
  return { api, restoreInto, runtime };
}

afterEach(cleanup);

describe('recovery drafts surface', () => {
  it('stays off screen until the folder lists a draft', async () => {
    const { runtime } = runtimeWith([]);
    const { container } = render(<RecoveryDrafts runtime={runtime} />);
    expect(container.innerHTML).toBe('');
    await runtime.refresh();
    expect(container.innerHTML).toBe('');
  });

  it('offers each draft with its staleness and lets the reader restore one', async () => {
    const { restoreInto, runtime } = runtimeWith([
      { currentVersion: 'v2', path: 'drafts/plan.md' },
      { currentVersion: 'v1', path: 'notes.md' },
    ]);
    await runtime.refresh();
    render(<RecoveryDrafts runtime={runtime} />);

    const region = screen.getByRole('region', { name: 'Unsaved changes from a previous session' });
    const rows = within(region).getAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'notes.md draft',
      'plan.md draft',
    ]);
    const stale = within(region).getByRole('listitem', { name: 'plan.md draft' });
    expect(stale.dataset.recoveryStaleness).toBe('changed');
    expect(within(stale).getByText('The file changed since this draft.')).not.toBeNull();
    expect(
      within(within(region).getByRole('listitem', { name: 'notes.md draft' })).queryByText(
        'The file changed since this draft.',
      ),
    ).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Restore plan.md draft' }));
    await waitFor(() => expect(restoreInto).toHaveBeenCalledTimes(1));
    expect(restoreInto).toHaveBeenCalledWith(
      { folderPath, path: 'drafts/plan.md' },
      { content: '# Draft', expectedVersion: 'v1' },
    );
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'plan.md draft' })).toBeNull(),
    );
    expect(screen.getByRole('listitem', { name: 'notes.md draft' })).not.toBeNull();
  });

  it('discards one draft or all of them, and the strip leaves when none remain', async () => {
    const { api, runtime } = runtimeWith([
      { currentVersion: 'v1', path: 'a.md' },
      { currentVersion: null, path: 'b.md' },
      { currentVersion: 'v1', path: 'c.md' },
    ]);
    await runtime.refresh();
    render(<RecoveryDrafts runtime={runtime} />);
    expect(screen.getByText('The file no longer exists.')).not.toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Discard b.md draft' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'b.md draft' })).toBeNull());
    expect(api.discard).toHaveBeenCalledWith({ folderPath, path: 'b.md' }, expect.any(AbortSignal));

    await user.click(screen.getByRole('button', { name: 'Discard all' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Unsaved changes from a previous session' }),
      ).toBeNull(),
    );
    expect(api.discard).toHaveBeenCalledTimes(3);
  });

  it('keeps a failed decision in the list and says why', async () => {
    const { api, runtime } = runtimeWith([{ currentVersion: 'v1', path: 'a.md' }]);
    api.discard = vi.fn(async () => {
      throw new Error('offline');
    });
    await runtime.refresh();
    render(<RecoveryDrafts runtime={runtime} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Discard a.md draft' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'The draft for a.md could not be reached.',
      ),
    );
    expect(screen.getByRole('listitem', { name: 'a.md draft' })).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Discard a.md draft' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

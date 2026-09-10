import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { EmbedderError, type EmbedderPort } from '@/features/settings/application/embedder-port';
import { failureMessage } from '@/features/settings/application/failure-messages';
import type { EmbedderState } from '@/features/settings/domain/embedder';
import { embedderPort, embedderState, SIGNED_IN_ACCOUNT } from '@/test/fakes/settings';
import { withQueryClient } from '@/test/query';

import { AiIndexPanel } from './ai-index-panel';

const signedOut = embedderState();

const signedIn = embedderState({
  account: SIGNED_IN_ACCOUNT,
  authorized: true,
  model: 'hosted',
  source: 'stashbase-account',
});

function renderPanel(port: EmbedderPort, onOpenExternal = vi.fn()) {
  withQueryClient(<AiIndexPanel embedderApi={port} onOpenExternal={onOpenExternal} />);
  return { onOpenExternal };
}

afterEach(cleanup);

describe('search by meaning settings panel', () => {
  it('shows the hosted account with its remaining credits and reset date', async () => {
    renderPanel(embedderPort(signedIn));

    expect(await screen.findByText('Ada Lovelace')).not.toBeNull();
    expect(screen.getByText('ada@example.com')).not.toBeNull();
    expect(screen.getByText(/25% remaining · 250 tokens left · Resets/u)).not.toBeNull();
    expect(
      screen.getByRole('radio', { name: 'StashBase account' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByText('Active')).not.toBeNull();
    expect(
      screen.getByText('Meaning-based search and indexing use your StashBase account.'),
    ).not.toBeNull();
  });

  it('starts a sign-in in the browser and saves a key without keeping it', async () => {
    const port = embedderPort(signedOut);
    const rendered = renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sign in to StashBase' }));
    await waitFor(() =>
      expect(rendered.onOpenExternal).toHaveBeenCalledWith('https://accounts.example/sign-in'),
    );
    expect(await screen.findByRole('button', { name: 'Waiting for browser…' })).not.toBeNull();
    expect(
      screen.getByText(
        'Searching by meaning isn’t set up. Sign in or add a key. Keyword search keeps working.',
      ),
    ).not.toBeNull();

    await user.type(screen.getByPlaceholderText('Paste the key'), 'sk-secret');
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    await waitFor(() =>
      expect(port.saveKey).toHaveBeenCalledWith('openai', 'sk-secret', expect.any(AbortSignal)),
    );
  });

  it('reports usage as temporarily unavailable and a rejected key as the reader’s to fix', async () => {
    const port = embedderPort(
      { ...signedIn, account: { ...SIGNED_IN_ACCOUNT, quota: null, quotaUnavailable: true } },
      {
        saveKey: vi.fn(async () => {
          throw new EmbedderError('rejected', 'HTTP 401 from the provider');
        }),
      },
    );
    renderPanel(port);
    const user = userEvent.setup();

    expect(await screen.findByText('Usage is temporarily unavailable.')).not.toBeNull();
    expect(screen.queryByPlaceholderText('Paste the key')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.type(screen.getByPlaceholderText('Paste the key'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect((await screen.findByRole('alert')).textContent).toBe(failureMessage('rejected'));
  });

  it('reports an unreachable embedder quietly rather than as something to correct', async () => {
    const port = embedderPort(embedderState({ hasKey: true }), {
      removeKey: vi.fn(async () => {
        throw new EmbedderError('unavailable', 'HTTP 503 from /api/embedder');
      }),
    });
    renderPanel(port);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove key' }));

    const notice = await screen.findByText(failureMessage('unavailable'));
    expect(notice.getAttribute('role')).toBe('status');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('switches the active source to a stored key by selecting its row', async () => {
    const withKey: EmbedderState = {
      ...signedIn,
      hasKey: true,
      provider: 'openrouter',
    };
    const port = embedderPort(withKey, {
      selectProvider: vi.fn(async () => ({ ...withKey, source: 'openrouter' as const })),
    });
    renderPanel(port);
    const user = userEvent.setup();

    const keyRow = await screen.findByRole('radio', { name: 'Your own API key' });
    expect(keyRow.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('OpenRouter key stored')).not.toBeNull();

    await user.click(keyRow);

    await waitFor(() =>
      expect(port.selectProvider).toHaveBeenCalledWith('openrouter', expect.any(AbortSignal)),
    );
  });

  it('marks the key row active when the stored key is the source', async () => {
    renderPanel(
      embedderPort({
        ...signedIn,
        hasKey: true,
        model: 'text-embedding-3-small',
        provider: 'openai',
        source: 'openai',
      }),
    );

    const keyRow = await screen.findByRole('radio', { name: 'Your own API key' });
    expect(keyRow.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByRole('radio', { name: 'StashBase account' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(
      screen.getByText('Meaning-based search and indexing use your OpenAI key.'),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Replace key' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Remove key' })).not.toBeNull();
  });
});

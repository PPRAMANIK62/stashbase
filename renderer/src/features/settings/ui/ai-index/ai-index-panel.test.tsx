import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { EmbedderPort, EmbedderState } from '@/features/settings/application/embedder-port';
import { useEmbedder } from '@/features/settings/hooks/use-embedder';

import { AiIndexPanel } from './ai-index-panel';

const signedOut: EmbedderState = {
  account: { active: false, signedIn: false },
  authorized: false,
  hasKey: false,
  model: 'text-embedding-3-small',
  provider: 'openai',
  source: 'openai',
};

const signedIn: EmbedderState = {
  account: {
    active: true,
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    quota: {
      grantedTokens: 1000,
      periodEndsAt: '2026-10-01T00:00:00.000Z',
      periodStartedAt: '2026-09-01T00:00:00.000Z',
      plan: 'free',
      remainingTokens: 250,
      reservedTokens: 0,
      usedTokens: 750,
    },
    signedIn: true,
  },
  authorized: true,
  hasKey: false,
  model: 'hosted',
  provider: 'openai',
  source: 'stashbase-account',
};

function fakePort(state: EmbedderState, overrides: Partial<EmbedderPort> = {}): EmbedderPort {
  return {
    load: vi.fn(async () => state),
    refreshAccount: vi.fn(async () => state.account),
    removeKey: vi.fn(async () => signedOut),
    saveKey: vi.fn(async () => ({
      authorized: true as const,
      hasKey: true as const,
      model: 'm',
      provider: 'openai' as const,
      source: 'openai' as const,
    })),
    selectProvider: vi.fn(async () => state),
    signInStatus: vi.fn(async () => ({ state: 'pending' as const })),
    signOut: vi.fn(async () => undefined),
    startSignIn: vi.fn(async () => ({
      flowId: 'flow-1',
      provider: 'google' as const,
      purpose: 'embedding' as const,
      url: 'https://accounts.example/sign-in',
    })),
    useAccount: vi.fn(async () => state.account),
    ...overrides,
  };
}

function renderPanel(port: EmbedderPort, onOpenExternal = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper() {
    const embedder = useEmbedder(port, true);
    return createElement(AiIndexPanel, { embedder, onOpenExternal });
  }
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient } as PropsWithChildren<{ client: QueryClient }>,
      createElement(Wrapper),
    ),
  );
  return { onOpenExternal };
}

let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

describe('AI Index panel', () => {
  it('shows the hosted account with its remaining allowance and reset date', async () => {
    renderPanel(fakePort(signedIn));

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
    const port = fakePort(signedOut);
    const rendered = renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sign in to StashBase' }));
    await waitFor(() =>
      expect(rendered.onOpenExternal).toHaveBeenCalledWith('https://accounts.example/sign-in'),
    );
    expect(await screen.findByRole('button', { name: 'Waiting for browser…' })).not.toBeNull();
    expect(
      screen.getByText('AI Index is not set up. Sign in or add a key. Exact search keeps working.'),
    ).not.toBeNull();

    await user.type(screen.getByPlaceholderText('Paste the key'), 'sk-secret');
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    await waitFor(() =>
      expect(port.saveKey).toHaveBeenCalledWith('openai', 'sk-secret', expect.any(AbortSignal)),
    );
  });

  it('reports usage as temporarily unavailable and a rejected key inline', async () => {
    const port = fakePort(
      { ...signedIn, account: { ...signedIn.account, quota: undefined, quotaUnavailable: true } },
      {
        saveKey: vi.fn(async () => {
          throw new Error('Invalid API key.');
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
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid API key.');
  });

  it('switches the active source to a stored key by selecting its row', async () => {
    const withKey: EmbedderState = {
      ...signedIn,
      hasKey: true,
      provider: 'openrouter',
    };
    const port = fakePort(withKey, {
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
      fakePort({
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

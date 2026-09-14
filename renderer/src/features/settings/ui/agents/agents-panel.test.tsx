import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import type { AccountPort, AgentRuntimePort } from '@/features/settings/application/ports';
import type { AgentCatalog, AgentRuntime } from '@/features/settings/domain/agent-catalog';
import {
  accountPort,
  agentRuntime,
  agentRuntimePort,
  SIGNED_IN_ACCOUNT,
} from '@/test/fakes/settings';
import { withQueryClient } from '@/test/query';

import { AgentRuntimesPanel } from './agents-panel';

function catalog(runtimes: AgentRuntime[], debug?: AgentCatalog['debug']): AgentCatalog {
  return { runtimes, debug: debug ?? null };
}

/** A reset runtime comes back not installed with nothing prepared for it. */
function uninstalled(runtime: AgentRuntime): AgentRuntime {
  return { ...runtime, installed: false, preparation: { kind: 'idle' } };
}

function renderPanel(
  port: AgentRuntimePort,
  account: AccountPort = accountPort(),
  onOpenExternal = vi.fn(),
) {
  const rendered = withQueryClient(
    <AgentRuntimesPanel
      accountApi={account}
      agentRuntimeApi={port}
      onOpenExternal={onOpenExternal}
    />,
  );
  return { ...rendered, onOpenExternal };
}

afterEach(cleanup);

const codex = agentRuntime({
  id: 'codex',
  installed: false,
  label: 'Codex',
  ownership: null,
  preparation: { kind: 'idle' },
});

const managedClaude = agentRuntime({ id: 'claude', label: 'Claude Code', ownership: 'managed' });

const enabledDebug: AgentCatalog['debug'] = {
  discoverySource: 'auto',
  nextSetupResult: 'none',
  nextTurnResult: 'none',
};

describe('AgentRuntimesPanel', () => {
  it('expands the token detail disclosure onto the panel it controls', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([managedClaude, agentRuntime()])),
    });
    renderPanel(port);
    const user = userEvent.setup();

    const summary = await screen.findByText('Token usage');
    const disclosure = summary.closest('details') as HTMLDetailsElement;
    expect(disclosure.open).toBe(false);

    await user.click(summary);

    expect(disclosure.open).toBe(true);
    expect(disclosure.contains(screen.getByText('0 input · 0 output · 0 cached'))).toBe(true);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('starts the browser sign-in from a runtime that needs an account', async () => {
    // The row's Sign in and the account row's Sign in are one command over one
    // port, so the runtime can never send the reader somewhere else to do it.
    const port = agentRuntimePort({
      listAgents: vi.fn(async () =>
        catalog([
          agentRuntime({
            id: 'stashbase',
            installed: true,
            label: 'OpenQuill',
            preparation: {
              failure: {
                note: 'An account is required to use OpenQuill.',
                refusal: 'account-required',
                stage: 'install',
              },
              kind: 'failed',
            },
          }),
        ]),
      ),
    });
    const account = accountPort();
    const rendered = renderPanel(port, account);
    const user = userEvent.setup();

    // Two Sign in buttons once the catalog has answered: the account row's
    // and the runtime row's. The runtime's is the one under test.
    await screen.findByText('An account is required to use OpenQuill.');
    const buttons = screen.getAllByRole('button', { name: 'Sign in' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1] as HTMLElement);
    await waitFor(() => expect(account.startSignIn).toHaveBeenCalledOnce());
    expect(rendered.onOpenExternal).toHaveBeenCalledWith('https://accounts.example/sign-in');
    expect(await screen.findByRole('button', { name: 'Waiting for browser…' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Stop waiting' }));
    expect(screen.queryByRole('button', { name: 'Waiting for browser…' })).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'Sign in' })[0] as HTMLElement);
    await waitFor(() => expect(account.startSignIn).toHaveBeenCalledTimes(2));
  });

  it('names the signed-in person under Account and signs out from there', async () => {
    const account = accountPort(SIGNED_IN_ACCOUNT);
    renderPanel(agentRuntimePort(), account);
    const user = userEvent.setup();

    expect(await screen.findByText('Ada Lovelace · ada@example.com')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    expect(await screen.findByText('Free credits')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(account.signOut).toHaveBeenCalledOnce());
    expect(await screen.findByRole('button', { name: 'Sign in' })).not.toBeNull();
  });

  it('installs a not-yet-installed runtime and writes the response into the catalog', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([codex])),
      prepareAgent: vi.fn(async () =>
        catalog([
          { ...codex, installed: true, ownership: 'system', preparation: { kind: 'ready' } },
        ]),
      ),
    });
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Install' }));

    expect(port.prepareAgent).toHaveBeenCalledWith('codex', 'bootstrap', expect.anything());
    await waitFor(() => expect(screen.getByText(/Ready to chat/)).not.toBeNull());
  });

  it('offers Uninstall only for a managed runtime and confirms before removing it', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([managedClaude])),
      resetManagedAgent: vi.fn(async () => catalog([uninstalled(managedClaude)])),
    });
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Uninstall' }));

    const dialog = await screen.findByRole('dialog', { name: 'Uninstall Claude Code?' });
    await user.click(within(dialog).getByRole('button', { name: 'Uninstall' }));

    expect(port.resetManagedAgent).toHaveBeenCalledWith('claude', expect.anything());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows a quiet retry row when the allowance fails to load, never a stale number', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([agentRuntime()])),
      getAllowance: vi.fn(async () => {
        throw new Error('unavailable');
      }),
    });
    renderPanel(port);

    expect(await screen.findByText('Could not load your credit balance.')).not.toBeNull();
    expect(screen.queryByText(/remaining/)).toBeNull();
  });

  it('hides the dev-only debug block while the catalog carries no debug controls', async () => {
    const port = agentRuntimePort({ listAgents: vi.fn(async () => catalog([codex])) });
    renderPanel(port);

    await screen.findByRole('button', { name: 'Install' });
    expect(screen.queryByText('Agent setup testing')).toBeNull();
  });

  it('keeps a failed install visible on its row instead of silently clearing the busy state', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([codex])),
      prepareAgent: vi.fn(async () => {
        throw new Error('Installer exited with status 1.');
      }),
    });
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Install' }));

    expect(await screen.findByText(failureMessage('unavailable'))).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Install' })).not.toBeNull();
  });

  it('keeps a failed uninstall visible inside the confirm dialog', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([managedClaude])),
      resetManagedAgent: vi.fn(async () => {
        throw new Error('Could not remove the managed install.');
      }),
    });
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Uninstall' }));
    const dialog = await screen.findByRole('dialog', { name: 'Uninstall Claude Code?' });
    await user.click(within(dialog).getByRole('button', { name: 'Uninstall' }));

    expect(await within(dialog).findByText(failureMessage('unavailable'))).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('reveals the debug block once the catalog carries debug controls', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([codex], enabledDebug)),
    });
    renderPanel(port);

    expect(await screen.findByText('Agent setup testing')).not.toBeNull();
    expect(screen.getByText('Development only')).not.toBeNull();
  });
});

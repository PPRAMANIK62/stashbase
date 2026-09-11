import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import type { AgentRuntimePort } from '@/features/settings/application/ports';
import type { AgentCatalog, AgentRuntime } from '@/features/settings/domain/agent-catalog';
import { agentRuntime, agentRuntimePort } from '@/test/fakes/settings';
import { withQueryClient } from '@/test/query';

import { AgentRuntimesPanel } from './agents-panel';

function catalog(runtimes: AgentRuntime[], debug?: AgentCatalog['debug']): AgentCatalog {
  return { runtimes, debug: debug ?? null };
}

/** A reset runtime comes back not installed with nothing prepared for it. */
function uninstalled(runtime: AgentRuntime): AgentRuntime {
  return { ...runtime, installed: false, preparation: { kind: 'idle' } };
}

/** Recorded per render so a case can assert the hand-off happened. */
let openedAccount = 0;

function renderPanel(port: AgentRuntimePort) {
  return withQueryClient(
    <AgentRuntimesPanel
      agentRuntimeApi={port}
      onOpenAccount={() => {
        openedAccount += 1;
      }}
    />,
  );
}

afterEach(() => {
  openedAccount = 0;
  cleanup();
});

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

    const disclosure = await screen.findByRole('button', { name: 'Token detail' });
    const panelId = disclosure.getAttribute('aria-controls');
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(panelId).not.toBeNull();

    await user.click(disclosure);

    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    const detail = screen.getByText('0 input · 0 output · 0 cached');
    expect(detail.id).toBe(panelId);
    expect(detail.hidden).toBe(false);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('hands a runtime that needs an account off to the section that owns sign-in', async () => {
    // The button used to render and do nothing. Whether it is the right home
    // for account identity is a separate question; a dead control is not.
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
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(openedAccount).toBe(1);
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
    await waitFor(() => expect(screen.getByText(/Ready for Chat/)).not.toBeNull());
  });

  it('offers Uninstall only for a managed runtime and confirms before removing it', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([managedClaude])),
      resetManagedAgent: vi.fn(async () => catalog([uninstalled(managedClaude)])),
    });
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Uninstall' }));

    const dialog = await screen.findByRole('dialog', { name: 'Uninstall Claude Code runtime?' });
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

    expect(await screen.findByText('Agent usage is temporarily unavailable.')).not.toBeNull();
    expect(screen.queryByText(/remaining/)).toBeNull();
  });

  it('hides the dev-only debug block while the catalog carries no debug controls', async () => {
    const port = agentRuntimePort({ listAgents: vi.fn(async () => catalog([codex])) });
    renderPanel(port);

    await screen.findByRole('button', { name: 'Install' });
    expect(screen.queryByText('Agent bootstrap testing')).toBeNull();
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
    const dialog = await screen.findByRole('dialog', { name: 'Uninstall Claude Code runtime?' });
    await user.click(within(dialog).getByRole('button', { name: 'Uninstall' }));

    expect(await within(dialog).findByText(failureMessage('unavailable'))).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('reveals the debug block once the catalog carries debug controls', async () => {
    const port = agentRuntimePort({
      listAgents: vi.fn(async () => catalog([codex], enabledDebug)),
    });
    renderPanel(port);

    expect(await screen.findByText('Agent bootstrap testing')).not.toBeNull();
    expect(screen.getByText('Development only')).not.toBeNull();
  });
});

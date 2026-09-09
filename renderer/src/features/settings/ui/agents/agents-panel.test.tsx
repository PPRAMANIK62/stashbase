import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentRuntimePort } from '@/features/settings/application/ports';
import { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';
import type { Agent, AgentsResponse } from '@/shared/agent-runtime';

import { AgentRuntimesPanel } from './agents-panel';

function catalog(clis: Agent[], debug?: AgentsResponse['debug']): AgentsResponse {
  return debug ? { clis, debug } : { clis };
}

function fakePort(overrides: Partial<AgentRuntimePort> = {}): AgentRuntimePort {
  return {
    getAllowance: vi.fn(async () => ({
      profile: 'stashbase-agent-default',
      remainingPercent: 62,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      windowStartedAt: null,
      windowEndsAt: null,
    })),
    listAgents: vi.fn(async () => catalog([])),
    prepareAgent: vi.fn(async () => catalog([])),
    resetManagedAgent: vi.fn(async () => catalog([])),
    updateDebug: vi.fn(async () => catalog([])),
    ...overrides,
  };
}

function renderPanel(port: AgentRuntimePort) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper() {
    const runtimes = useAgentRuntimes(port);
    return createElement(AgentRuntimesPanel, { runtimes });
  }
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient } as PropsWithChildren<{ client: QueryClient }>,
      createElement(Wrapper),
    ),
  );
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

const codex: Agent = {
  id: 'codex',
  label: 'Codex',
  vendor: 'OpenAI',
  installHint: 'npm install -g codex',
  installed: false,
  launchCommand: 'codex',
};

const managedClaude: Agent = {
  id: 'claude',
  label: 'Claude Code',
  vendor: 'Anthropic',
  installHint: '',
  installed: true,
  source: 'managed',
  bootstrap: { phase: 'ready' },
  launchCommand: 'claude',
};

describe('AgentRuntimesPanel', () => {
  it('uses the managed disclosure and one-step inset surfaces for runtime details', async () => {
    const port = fakePort({
      listAgents: vi.fn(async () =>
        catalog([
          managedClaude,
          { ...managedClaude, id: 'stashbase', label: 'Built-in', source: 'bundled' },
        ]),
      ),
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
    const runtimeList = screen.getByRole('list');
    expect(runtimeList.className).toContain('bg-surface-4');
    const runtimeIcon = screen.getByText('Claude Code').closest('li')?.firstElementChild;
    expect(runtimeIcon?.className).toContain('bg-surface-3');
  });

  it('installs a not-yet-installed runtime and writes the response into the catalog', async () => {
    const port = fakePort({
      listAgents: vi.fn(async () => catalog([codex])),
      prepareAgent: vi.fn(async () =>
        catalog([{ ...codex, installed: true, bootstrap: { phase: 'ready' } }]),
      ),
    });
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Install' }));

    expect(port.prepareAgent).toHaveBeenCalledWith('codex', 'bootstrap', expect.anything());
    await waitFor(() => expect(screen.getByText(/Ready for Chat/)).not.toBeNull());
  });

  it('offers Uninstall only for a managed runtime and confirms before removing it', async () => {
    const port = fakePort({
      listAgents: vi.fn(async () => catalog([managedClaude])),
      resetManagedAgent: vi.fn(async () =>
        catalog([{ ...managedClaude, installed: false, bootstrap: undefined }]),
      ),
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
    const port = fakePort({
      listAgents: vi.fn(async () =>
        catalog([{ ...managedClaude, id: 'stashbase', source: 'bundled' }]),
      ),
      getAllowance: vi.fn(async () => {
        throw new Error('unavailable');
      }),
    });
    renderPanel(port);

    expect(await screen.findByText('Agent usage is temporarily unavailable.')).not.toBeNull();
    expect(screen.queryByText(/remaining/)).toBeNull();
  });

  it('hides the dev-only debug block until the server reports it enabled', async () => {
    const port = fakePort({
      listAgents: vi.fn(async () =>
        catalog([codex], {
          enabled: false,
          discoveryPolicy: 'auto',
          nextFailure: 'none',
          nextTurnFailure: 'none',
        }),
      ),
    });
    renderPanel(port);

    await screen.findByRole('button', { name: 'Install' });
    expect(screen.queryByText('Agent bootstrap testing')).toBeNull();
  });

  it('keeps a failed install visible on its row instead of silently clearing the busy state', async () => {
    const port = fakePort({
      listAgents: vi.fn(async () => catalog([codex])),
      prepareAgent: vi.fn(async () => {
        throw new Error('Installer exited with status 1.');
      }),
    });
    renderPanel(port);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Install' }));

    expect(await screen.findByText('Installer exited with status 1.')).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Install' })).not.toBeNull();
  });

  it('keeps a failed uninstall visible inside the confirm dialog', async () => {
    const port = fakePort({
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

    expect(await within(dialog).findByText('Could not remove the managed install.')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('reveals the debug block once the catalog reports debug.enabled', async () => {
    const port = fakePort({
      listAgents: vi.fn(async () =>
        catalog([codex], {
          enabled: true,
          discoveryPolicy: 'auto',
          nextFailure: 'none',
          nextTurnFailure: 'none',
        }),
      ),
    });
    renderPanel(port);

    expect(await screen.findByText('Agent bootstrap testing')).not.toBeNull();
    expect(screen.getByText('Development only')).not.toBeNull();
  });
});

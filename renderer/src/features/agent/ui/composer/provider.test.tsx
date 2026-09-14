import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { agentDefinition, BUILT_IN_AGENT, CLAUDE_AGENT, CODEX_AGENT } from '@/test/fakes/agent';

import { AgentProviderControl } from './provider';

afterEach(cleanup);

describe('agent composer provider control', () => {
  it('names the running agent and offers every catalog entry with the current one marked', async () => {
    const onAgentChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentProviderControl
        activeAgent={BUILT_IN_AGENT}
        agents={[BUILT_IN_AGENT, CODEX_AGENT, CLAUDE_AGENT]}
        disabled={false}
        onAgentChange={onAgentChange}
        onPrepare={vi.fn()}
        onSignIn={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Provider: OpenQuill' });
    expect(trigger.title).toBe('Provider: OpenQuill');
    await user.click(trigger);

    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(3);
    expect(
      screen
        .getAllByRole('menuitemradio', { checked: true })
        .map((option) => option.getAttribute('aria-label')),
    ).toEqual(['OpenQuill']);
    for (const name of ['Codex', 'Claude Code']) {
      expect(screen.getByRole('menuitemradio', { name })).not.toBeNull();
    }
    await user.click(screen.getByRole('menuitemradio', { name: 'Codex' }));
    expect(onAgentChange).toHaveBeenCalledWith('codex');
  });

  it('names a runtime that is not ready yet and starts what it waits for', async () => {
    const onAgentChange = vi.fn();
    const onPrepare = vi.fn();
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentProviderControl
        activeAgent={CODEX_AGENT}
        // The bundled runtime before anything has been tried: the catalog
        // cannot know yet that it wants an account, and it must still not be
        // offered a setup step it does not have.
        agents={[
          agentDefinition({ needsSignIn: false, ready: false }),
          CODEX_AGENT,
          agentDefinition({ id: 'claude', label: 'Claude Code', ready: false }),
        ]}
        disabled={false}
        onAgentChange={onAgentChange}
        onPrepare={onPrepare}
        onSignIn={onSignIn}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Provider: Codex' }));
    // The unprepared rows are offers, not choices: they carry no check and
    // they say what they are waiting for.
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: 'OpenQuill. Sign in' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Claude Code. Set up' })).not.toBeNull();

    // The bundled runtime waits on the account, which no catalog command can
    // start, so the row routes to where the account is signed in.
    await user.click(screen.getByRole('menuitem', { name: 'OpenQuill. Sign in' }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(onPrepare).not.toHaveBeenCalled();
    expect(onAgentChange).not.toHaveBeenCalled();
  });

  it('prepares a runtime whose own installation is what is missing', async () => {
    const onPrepare = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentProviderControl
        activeAgent={CODEX_AGENT}
        agents={[
          CODEX_AGENT,
          agentDefinition({ id: 'claude', label: 'Claude Code', ready: false }),
        ]}
        disabled={false}
        onAgentChange={vi.fn()}
        onPrepare={onPrepare}
        onSignIn={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Provider: Codex' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Claude Code. Set up' }));
    expect(onPrepare).toHaveBeenCalledWith('claude', 'bootstrap');
  });

  it('binds the provider for the run of a streaming turn', () => {
    render(
      <AgentProviderControl
        activeAgent={CODEX_AGENT}
        agents={[BUILT_IN_AGENT, CODEX_AGENT]}
        disabled
        onAgentChange={vi.fn()}
        onPrepare={vi.fn()}
        onSignIn={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Provider: Codex' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

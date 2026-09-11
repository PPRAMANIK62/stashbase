import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { BUILT_IN_AGENT, CLAUDE_AGENT, CODEX_AGENT } from '@/test/fakes/agent';

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

  it('binds the provider for the run of a streaming turn', () => {
    render(
      <AgentProviderControl
        activeAgent={CODEX_AGENT}
        agents={[BUILT_IN_AGENT, CODEX_AGENT]}
        disabled
        onAgentChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Provider: Codex' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

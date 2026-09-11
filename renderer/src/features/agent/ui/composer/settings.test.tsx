import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentModel } from '@/features/agent/domain/runtime-catalog';
import { BUILT_IN_AGENT, CLAUDE_AGENT, CODEX_AGENT } from '@/test/fakes/agent';

import { AgentComposerSettings } from './settings';

type SettingsProps = ComponentProps<typeof AgentComposerSettings>;
type SettingsState = SettingsProps['state'];

const GPT: AgentModel = {
  id: 'gpt-codex',
  label: 'Codex Max',
  supportedEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'auto'],
};
const MINI: AgentModel = { id: 'gpt-mini', label: 'Codex Mini' };

function sessionState(overrides: Partial<SettingsState> = {}): SettingsState {
  return {
    activeModel: null,
    activeTurn: false,
    effort: null,
    model: null,
    models: [],
    transcript: [],
    ...overrides,
  };
}

function renderSettings(overrides: Partial<SettingsProps> = {}) {
  const spies = {
    onAgentChange: vi.fn<SettingsProps['onAgentChange']>(),
    onEffortChange: vi.fn<SettingsProps['onEffortChange']>(),
    onModelChange: vi.fn<SettingsProps['onModelChange']>(),
    onRequestCatalog: vi.fn<SettingsProps['onRequestCatalog']>(),
  };
  const view = render(
    <AgentComposerSettings
      {...spies}
      activeAgent={overrides.activeAgent ?? BUILT_IN_AGENT}
      agents={overrides.agents ?? [BUILT_IN_AGENT, CODEX_AGENT, CLAUDE_AGENT]}
      state={overrides.state ?? sessionState()}
    />,
  );
  return { ...spies, user: userEvent.setup(), view };
}

/** The accessible names of the options an open menu marks as selected. */
function checkedNames(): string[] {
  return screen
    .getAllByRole('menuitemradio', { checked: true })
    .map((option) => option.getAttribute('aria-label') ?? option.textContent ?? '');
}

afterEach(cleanup);

describe('agent composer provider control', () => {
  it('names the running agent and offers every catalog entry with the current one marked', async () => {
    const { onAgentChange, user } = renderSettings();

    const trigger = screen.getByRole('button', { name: 'Provider: OpenQuill' });
    expect(trigger.title).toBe('Provider: OpenQuill');
    await user.click(trigger);

    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(3);
    expect(checkedNames()).toEqual(['OpenQuill']);
    for (const name of ['Codex', 'Claude Code']) {
      expect(screen.getByRole('menuitemradio', { name })).not.toBeNull();
    }
    await user.click(screen.getByRole('menuitemradio', { name: 'Codex' }));
    expect(onAgentChange).toHaveBeenCalledWith('codex');
  });

  it('offers only the provider for a runtime that advertises no model or effort choice', () => {
    renderSettings();

    expect(screen.getByRole('button', { name: 'Provider: OpenQuill' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^Model:/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Thinking:/u })).toBeNull();
  });
});

describe('agent composer model control', () => {
  it('reads Default until a model is chosen and re-reads the catalog when opened', async () => {
    const { onModelChange, onRequestCatalog, user } = renderSettings({
      activeAgent: CODEX_AGENT,
      state: sessionState({ models: [GPT, MINI] }),
    });

    const trigger = screen.getByRole('button', { name: 'Model: Default' });
    expect(trigger.title).toBe('Model: Default');
    await user.click(trigger);
    expect(onRequestCatalog).toHaveBeenCalledTimes(1);

    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(3);
    expect(checkedNames()).toEqual(['Default']);
    expect(screen.getByRole('menuitemradio', { name: 'Codex Max' })).not.toBeNull();
    await user.click(screen.getByRole('menuitemradio', { name: 'Codex Mini' }));
    expect(onModelChange).toHaveBeenCalledWith('gpt-mini');
  });

  it('names the selected model and hands back the runtime default', async () => {
    const { onModelChange, user } = renderSettings({
      activeAgent: CODEX_AGENT,
      state: sessionState({ model: 'gpt-codex', models: [GPT, MINI] }),
    });

    await user.click(screen.getByRole('button', { name: 'Model: Codex Max' }));
    expect(checkedNames()).toEqual(['Codex Max']);
    await user.click(screen.getByRole('menuitemradio', { name: 'Default' }));
    expect(onModelChange).toHaveBeenCalledWith(null);
  });

  it('binds the model for the run of a streaming turn', () => {
    renderSettings({
      activeAgent: CODEX_AGENT,
      state: sessionState({ activeTurn: true, models: [GPT] }),
    });

    for (const name of ['Provider: Codex', 'Model: Default', 'Thinking: Default']) {
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
  });

  it('locks the model once a Claude Code conversation has started', () => {
    renderSettings({
      activeAgent: CLAUDE_AGENT,
      state: sessionState({
        models: [GPT],
        transcript: [{ id: 'u1', kind: 'user', text: 'Summarize the plan' }],
      }),
    });

    expect(screen.getByRole('button', { name: 'Model: Default' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Provider: Claude Code' }).hasAttribute('disabled'),
    ).toBe(false);
  });
});

describe('agent composer thinking control', () => {
  it('offers the efforts of the selected model and says what each one buys', async () => {
    const { onEffortChange, user } = renderSettings({
      activeAgent: CODEX_AGENT,
      state: sessionState({ model: 'gpt-codex', models: [GPT] }),
    });

    await user.click(screen.getByRole('button', { name: 'Thinking: Default' }));
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(7);
    for (const name of [
      'Default',
      'Low. Faster',
      'Medium. Balanced',
      'High. Deeper reasoning',
      'Extra high. Deepest reasoning',
      'Max. Maximum reasoning',
      'Auto',
    ]) {
      expect(screen.getByRole('menuitemradio', { name })).not.toBeNull();
    }

    await user.click(screen.getByRole('menuitemradio', { name: 'Extra high. Deepest reasoning' }));
    expect(onEffortChange).toHaveBeenCalledWith('xhigh');
  });

  it('reads back the chosen effort as a sentence and hands back the default', async () => {
    const { onEffortChange, user } = renderSettings({
      activeAgent: CODEX_AGENT,
      state: sessionState({ effort: 'xhigh', model: 'gpt-codex', models: [GPT] }),
    });

    await user.click(screen.getByRole('button', { name: 'Thinking: Extra high' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Default' }));
    expect(onEffortChange).toHaveBeenCalledWith(null);
  });

  it('falls back to the model the runtime is actually running when none is chosen', () => {
    renderSettings({
      activeAgent: CODEX_AGENT,
      state: sessionState({ activeModel: 'gpt-codex', models: [GPT, MINI] }),
    });

    expect(screen.getByRole('button', { name: 'Model: Default' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Thinking: Default' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('closes the effort control for a model that accepts no effort level', () => {
    renderSettings({
      activeAgent: CODEX_AGENT,
      state: sessionState({ model: 'gpt-mini', models: [MINI] }),
    });

    expect(screen.getByRole('button', { name: 'Thinking: Default' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentScope } from '@/features/agent/domain/session-state';
import { agentPersonaApi } from '@/test/fakes/agent';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useAgentPersona } from './use-agent-persona';

afterEach(cleanup);

const RESEARCH: AgentScope = { kind: 'folder', path: '/project/Research' };
const NOTES: AgentScope = { kind: 'folder', path: '/project/notes' };

function mount(port = agentPersonaApi(), scope: AgentScope | null = RESEARCH) {
  const applied = vi.fn();
  const wrapper = queryWrapper(createTestQueryClient());
  const hook = renderHook(({ s }: { s: AgentScope | null }) => useAgentPersona(port, s, applied), {
    initialProps: { s: scope },
    wrapper,
  });
  return { applied, hook, port };
}

describe('useAgentPersona', () => {
  it('reads nothing while no chat is scoped', () => {
    const { hook, port } = mount(agentPersonaApi(), null);
    expect(hook.result.current.loading).toBe(false);
    expect(port.load).not.toHaveBeenCalled();
  });

  it('saves a pick into the scope it was made in and restarts the chat to apply it', async () => {
    const { applied, hook, port } = mount(agentPersonaApi(), NOTES);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    act(() => hook.result.current.choose('journalist'));

    await waitFor(() => expect(hook.result.current.selected).toBe('journalist'));
    expect(port.save).toHaveBeenCalledWith(NOTES, { selected: 'journalist' }, expect.anything());
    expect(applied).toHaveBeenCalledTimes(1);
  });

  it('does not restart the chat for a pick that is already running', async () => {
    const { applied, hook, port } = mount();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    act(() => hook.result.current.choose(null));

    expect(port.save).not.toHaveBeenCalled();
    expect(applied).not.toHaveBeenCalled();
  });

  it('stores the custom prompt, chooses it, and keeps it across a later preset', async () => {
    const { applied, hook } = mount();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    let stored = false;
    await act(async () => {
      stored = await hook.result.current.saveCustom('Short sentences. No jargon.');
    });
    expect(stored).toBe(true);
    await waitFor(() => expect(hook.result.current.selected).toBe('custom'));

    act(() => hook.result.current.choose('storyteller'));
    await waitFor(() => expect(hook.result.current.selected).toBe('storyteller'));
    expect(hook.result.current.custom).toBe('Short sentences. No jargon.');
    expect(applied).toHaveBeenCalledTimes(2);
  });

  it('keeps the running persona and reports a refused save without restarting', async () => {
    const port = agentPersonaApi({
      save: vi.fn(async () => {
        throw new Error('refused');
      }),
    });
    const { applied, hook } = mount(port);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    let stored = true;
    await act(async () => {
      stored = await hook.result.current.saveCustom('Mine.');
    });

    expect(stored).toBe(false);
    await waitFor(() => expect(hook.result.current.failure).not.toBeNull());
    expect(hook.result.current.selected).toBeNull();
    expect(applied).not.toHaveBeenCalled();
  });
});

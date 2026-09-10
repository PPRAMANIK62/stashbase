import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentScope } from '@/features/agent/domain/session-state';
import { agentInstructionsApi } from '@/test/fakes/agent';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useAgentInstructions } from './use-agent-instructions';

afterEach(cleanup);

const LIBRARY: AgentScope = { kind: 'library' };
const FOLDER: AgentScope = { kind: 'folder', path: '/library/notes' };

function mount(port = agentInstructionsApi(), scope: AgentScope | null = LIBRARY) {
  const wrapper = queryWrapper(createTestQueryClient());
  const hook = renderHook(({ s }: { s: AgentScope | null }) => useAgentInstructions(port, s), {
    initialProps: { s: scope },
    wrapper,
  });
  return { hook, port };
}

describe('useAgentInstructions', () => {
  it('reads the standing text for the active scope', async () => {
    const { hook } = mount();
    await waitFor(() => expect(hook.result.current.draft).toBe('Packaged default.'));
    expect(hook.result.current.customized).toBe(false);
  });

  it('reads nothing while no chat is scoped', () => {
    const { hook, port } = mount(agentInstructionsApi(), null);
    expect(hook.result.current.loading).toBe(false);
    expect(port.load).not.toHaveBeenCalled();
  });

  it('reports a customized scope, which is what the presence dot shows', async () => {
    const port = agentInstructionsApi({
      load: vi.fn(async () => ({ customized: true, text: 'Mine.' })),
    });
    const { hook } = mount(port);
    await waitFor(() => expect(hook.result.current.customized).toBe(true));
  });

  it('is not dirty until the draft differs from what is stored', async () => {
    const { hook } = mount();
    await waitFor(() => expect(hook.result.current.draft).toBe('Packaged default.'));
    expect(hook.result.current.dirty).toBe(false);

    act(() => hook.result.current.setDraft('Packaged default.'));
    expect(hook.result.current.dirty).toBe(false);

    act(() => hook.result.current.setDraft('Mine now.'));
    expect(hook.result.current.dirty).toBe(true);
  });

  it('saves into the scope it is showing', async () => {
    const { hook, port } = mount(agentInstructionsApi(), FOLDER);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.setDraft('Folder rules.'));
    act(() => hook.result.current.save());

    await waitFor(() =>
      expect(port.save).toHaveBeenCalledWith(FOLDER, 'Folder rules.', expect.anything()),
    );
  });

  it('re-reads on a scope change and abandons the draft that belonged to the old one', async () => {
    const { hook, port } = mount();
    await waitFor(() => expect(port.load).toHaveBeenCalledTimes(1));
    act(() => hook.result.current.setDraft('Library rules.'));
    expect(hook.result.current.dirty).toBe(true);

    hook.rerender({ s: FOLDER });

    await waitFor(() => expect(port.load).toHaveBeenCalledTimes(2));
    expect(port.load).toHaveBeenLastCalledWith(FOLDER, expect.anything());
    // The draft belonged to the scope the reader left; carrying it forward
    // would offer to save it into the new one.
    await waitFor(() => expect(hook.result.current.dirty).toBe(false));
  });

  it('restores the packaged default by saving nothing at all', async () => {
    const port = agentInstructionsApi({
      load: vi.fn(async () => ({ customized: true, text: 'Mine.' })),
    });
    const { hook } = mount(port);
    await waitFor(() => expect(hook.result.current.draft).toBe('Mine.'));

    act(() => hook.result.current.reset());
    expect(hook.result.current.draft).toBe('');
    act(() => hook.result.current.save());

    await waitFor(() => expect(port.save).toHaveBeenCalledWith(LIBRARY, '', expect.anything()));
  });

  it('keeps the draft when a save is refused', async () => {
    const port = agentInstructionsApi({
      save: vi.fn(async () => {
        throw new Error('refused');
      }),
    });
    const { hook } = mount(port);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.setDraft('Mine now.'));
    act(() => hook.result.current.save());

    await waitFor(() => expect(hook.result.current.failure).not.toBeNull());
    expect(hook.result.current.draft).toBe('Mine now.');
  });
});

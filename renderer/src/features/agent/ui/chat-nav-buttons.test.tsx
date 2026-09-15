import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import { agentSessionPort } from '@/test/fakes/agent';

import { ChatNavButtons } from './chat-nav-buttons';

const runtimes: AgentWorkspaceRuntime[] = [];
let nextId = 0;

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

function createRuntime() {
  const runtime = createAgentWorkspaceRuntime({
    autostart: false,
    createId: () => `chat-${(nextId += 1)}`,
    folderPath: '/Library/Research',
    port: agentSessionPort().port,
  });
  runtimes.push(runtime);
  return runtime;
}

function navButtons() {
  return {
    next: screen.getByRole<HTMLButtonElement>('button', { name: 'Next chat' }),
    previous: screen.getByRole<HTMLButtonElement>('button', { name: 'Previous chat' }),
  };
}

describe('ChatNavButtons', () => {
  it('waits fully disabled while there is nothing to step through', () => {
    const runtime = createRuntime();
    render(<ChatNavButtons runtime={runtime} />);
    const { next, previous } = navButtons();
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it('follows visits instead of creation order and discards forward history on a new visit', async () => {
    const runtime = createRuntime();
    const first = runtime.newChat();
    first.setDraft('first draft');
    const second = runtime.newChat();
    second.setDraft('second draft');
    const third = runtime.newChat();
    third.setDraft('third draft');
    runtime.activate(first.id);
    render(<ChatNavButtons runtime={runtime} />);
    const user = userEvent.setup();
    await user.click(navButtons().previous);
    expect(runtime.store.getState().activeId).toBe(third.id);
    await user.click(navButtons().previous);
    expect(runtime.store.getState().activeId).toBe(second.id);
    await user.click(navButtons().next);
    expect(runtime.store.getState().activeId).toBe(third.id);
    runtime.activate(second.id);
    expect(runtime.store.getState().visits.at(-1)).toBe(second.id);
    expect(runtime.store.getState().visitIndex).toBe(runtime.store.getState().visits.length - 1);
  });
});

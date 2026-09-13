import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

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

  it('steps back and forward through the open chats in tab order', async () => {
    const runtime = createRuntime();
    // A blank chat is reused rather than duplicated, so the first must hold
    // a draft before a second tab can exist.
    runtime.newChat().setDraft('keep me');
    runtime.newChat();
    const tabs = runtime.store.getState().tabs;
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    const activate = vi.spyOn(runtime, 'activate');
    render(<ChatNavButtons runtime={runtime} />);

    // The newest chat is active, so only the step back is available.
    const { next, previous } = navButtons();
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    const user = userEvent.setup();
    await user.click(previous);
    const activeIndex = tabs.findIndex((tab) => tab.id === runtime.store.getState().activeId);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(runtime.store.getState().activeId).toBe(tabs[activeIndex]?.id);

    // A step back opens the way forward again.
    expect(navButtons().next.disabled).toBe(false);
    await user.click(navButtons().next);
    expect(runtime.store.getState().activeId).toBe(tabs[activeIndex + 1]?.id);
  });
});

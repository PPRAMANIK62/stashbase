import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import type { Agent } from '@/features/agent/domain/agent-catalog';
import {
  agentCatalogPort,
  agentSessionPort,
  BUILT_IN_AGENT,
  CODEX_AGENT,
} from '@/test/fakes/agent';
import { createTestQueryClient, withQueryClient } from '@/test/query';

import { NewChatButton } from './new-chat-button';

const RESEARCH_SCOPE = { kind: 'folder', path: '/Library/Research' } as const;

const runtimes: AgentWorkspaceRuntime[] = [];

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

function renderButton(agents: readonly Agent[]) {
  const runtime = createAgentWorkspaceRuntime({
    autostart: false,
    createId: () => `chat-${runtimes.length + 1}`,
    folderPath: RESEARCH_SCOPE.path,
    port: agentSessionPort().port,
  });
  runtimes.push(runtime);
  const newChat = vi.spyOn(runtime, 'newChat');
  withQueryClient(
    <NewChatButton catalog={agentCatalogPort(agents)} runtime={runtime} scope={RESEARCH_SCOPE} />,
    createTestQueryClient(),
  );
  return { newChat, runtime };
}

describe('NewChatButton', () => {
  it('starts a draft using the project choice regardless of readiness', async () => {
    const { newChat } = renderButton([CODEX_AGENT, BUILT_IN_AGENT]);
    const button = await screen.findByRole('button', { name: 'New chat' });
    await userEvent.setup().click(button);
    expect(newChat).toHaveBeenCalledWith(undefined, RESEARCH_SCOPE);
  });

  it('allows a Default draft while no runtime is ready', async () => {
    const { runtime } = renderButton([]);
    const button = await screen.findByRole('button', { name: 'New chat' });
    await userEvent.setup().click(button);
    expect(runtime.activeSession().store.getState().agent).toBe('stashbase');
  });
});

import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentSessionPort } from '@/features/agent/application/ports';
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import { idleAgentSessionPort } from '@/test/fakes/agent';
import { createTestQueryClient, withQueryClient } from '@/test/query';

import { ChatHistoryPopover } from './history-popover';

const SCOPE = { kind: 'folder', path: '/Library/Research' } as const;
const HOUR = 3_600_000;

const runtimes: AgentWorkspaceRuntime[] = [];

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

function renderPopover() {
  const now = Date.now();
  const entries = [
    {
      agent: 'codex' as const,
      hasContent: true,
      id: 'notes',
      lastModified: now - 22 * HOUR,
      scope: SCOPE,
      title: 'Planning notes',
    },
    {
      agent: 'codex' as const,
      hasContent: true,
      id: 'gallery',
      lastModified: now - 50 * HOUR,
      scope: SCOPE,
      title: 'Refine Gallery subtitle',
    },
  ];
  const runtime = createAgentWorkspaceRuntime({
    autostart: false,
    createId: () => `chat-${runtimes.length + 1}`,
    folderPath: SCOPE.path,
    port: idleAgentSessionPort({
      list: vi.fn<AgentSessionPort['list']>(async (agent) => (agent === 'codex' ? entries : [])),
    }),
  });
  runtimes.push(runtime);
  const restore = vi.spyOn(runtime, 'restore').mockResolvedValue(true);
  withQueryClient(<ChatHistoryPopover runtime={runtime} scope={SCOPE} />, createTestQueryClient());
  return { entries, restore };
}

describe('ChatHistoryPopover', () => {
  it('lists the recent chats with their age, filters by title, and restores the chosen one', async () => {
    const { entries, restore } = renderPopover();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Chat history' }));
    const search = await screen.findByRole('combobox', { name: 'Search recent chats' });
    await waitFor(() => expect(search).toBe(document.activeElement));
    expect(await screen.findByRole('option', { name: 'Planning notes, 22h' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Refine Gallery subtitle, 2d' })).not.toBeNull();

    await user.keyboard('gallery');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await user.keyboard('{Enter}');

    expect(restore).toHaveBeenCalledWith(entries[1]);
    // The popover closes behind the choice.
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: 'Search recent chats' })).toBeNull(),
    );
  });

  it('says so while there is nothing to list', async () => {
    const runtime = createAgentWorkspaceRuntime({
      autostart: false,
      createId: () => 'chat-1',
      folderPath: SCOPE.path,
      port: idleAgentSessionPort({ list: vi.fn(async () => []) }),
    });
    runtimes.push(runtime);
    withQueryClient(
      <ChatHistoryPopover runtime={runtime} scope={SCOPE} />,
      createTestQueryClient(),
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Chat history' }));
    expect(await screen.findByText('No chats yet in Research.')).not.toBeNull();
  });
});

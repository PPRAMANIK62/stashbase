import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  AgentConversationGroup,
  AgentHistoryEntry,
} from '@/features/agent/domain/conversation-history';
import { pressKey } from '@/test/dom';

import { ConversationTree } from './conversation-tree';

afterEach(cleanup);

function entry(id: string, title: string): AgentHistoryEntry {
  return {
    agent: 'codex',
    hasContent: true,
    id,
    lastModified: 1,
    scope: { kind: 'folder', path: '/library/Research' },
    title,
  };
}

function group(overrides: Partial<AgentConversationGroup> = {}): AgentConversationGroup {
  return {
    id: 'today',
    items: [
      {
        active: false,
        agent: 'codex',
        entry: entry('native-1', 'Reading list'),
        id: 'codex:native-1',
        lastModified: 1,
        title: 'Reading list',
      },
    ],
    label: 'Today',
    ...overrides,
  };
}

function renderTree(groups: AgentConversationGroup[], spies = {}) {
  const handlers = {
    onActivate: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onRestore: vi.fn(),
    ...spies,
  };
  const view = render(<ConversationTree groups={groups} {...handlers} />);
  return { ...handlers, view };
}

describe('conversation tree', () => {
  it('restores a closed conversation and activates an open one', async () => {
    const { onActivate, onRestore } = renderTree([
      group({
        items: [
          {
            active: false,
            agent: 'codex',
            entry: entry('native-1', 'Closed chat'),
            id: 'codex:native-1',
            lastModified: 1,
            title: 'Closed chat',
          },
          {
            active: true,
            agent: 'codex',
            id: 'local:chat-2',
            lastModified: 2,
            tabId: 'chat-2',
            title: 'Open chat',
          },
        ],
      }),
    ]);

    // A single click settles after the double-click window, so the row can
    // still turn the second click into an inline rename.
    await userEvent.click(screen.getByRole('button', { name: 'Closed chat' }));
    await waitFor(() =>
      expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'native-1' })),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    await waitFor(() => expect(onActivate).toHaveBeenCalledWith('chat-2'));
  });

  it('renames in place from F2 and commits the edited title', async () => {
    const { onRename } = renderTree([group()]);

    pressKey(screen.getByRole('button', { name: 'Reading list' }), 'F2');
    const field = screen.getByRole('textbox', { name: 'Rename Reading list' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Weekly reading{Enter}');

    expect(onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'codex:native-1' }),
      'Weekly reading',
    );
  });

  it('abandons an edit on Escape without renaming', () => {
    const { onRename } = renderTree([group()]);

    pressKey(screen.getByRole('button', { name: 'Reading list' }), 'F2');
    const field = screen.getByRole('textbox', { name: 'Rename Reading list' });
    act(() => {
      fireEvent.change(field, { target: { value: 'Discarded' } });
    });
    pressKey(field, 'Escape');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reading list' })).not.toBeNull();
  });

  it('offers deletion only for a conversation the service knows about', async () => {
    const { onDelete } = renderTree([
      group({
        items: [
          ...group().items,
          {
            active: false,
            agent: 'codex',
            id: 'local:chat-3',
            lastModified: 3,
            tabId: 'chat-3',
            title: 'Unsaved chat',
          },
        ],
      }),
    ]);

    expect(screen.getAllByRole('button', { name: /^Actions for/u })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Reading list' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'native-1' }));
  });

  it('pages a long group behind one Show more control', async () => {
    const items = Array.from({ length: 101 }, (_, index) => ({
      active: false,
      agent: 'codex' as const,
      id: `local:chat-${index}`,
      lastModified: index,
      tabId: `chat-${index}`,
      title: `Chat ${index}`,
    }));
    renderTree([group({ items })]);

    const menu = screen.getByRole('list', { name: 'Today chats' });
    expect(within(menu).getAllByRole('button')).toHaveLength(100);
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(within(menu).getAllByRole('button')).toHaveLength(101);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});

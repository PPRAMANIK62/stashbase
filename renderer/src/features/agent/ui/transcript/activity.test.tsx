import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectFocused } from '@/test/dom';

import { AgentActivityGroup, AgentPermissionCard } from './activity';
import type { AgentToolBlock } from './tool-presentation';

const command: AgentToolBlock = {
  id: 'tool-1',
  input: { command: 'pnpm test:agent' },
  kind: 'tool',
  name: 'Bash',
  status: 'running',
};

afterEach(cleanup);

describe('Agent activity', () => {
  it('keeps ordinary activity collapsed behind an accessible disclosure', async () => {
    render(<AgentActivityGroup tools={[command]} />);

    const summary = screen.getByRole('button', { name: 'Ran command…' });
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Ran.*pnpm test:agent.*Running/u })).not.toBeNull();
  });

  it('presents a permission as an explicit decision and restores focus to its heading', async () => {
    const onReply = vi.fn(() => true);
    const { rerender } = render(
      <AgentPermissionCard
        onReply={onReply}
        tool={{
          ...command,
          permissionId: 'permission-1',
          permissionRequested: true,
          status: 'awaiting',
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onReply).toHaveBeenCalledWith('tool-1', 'permission-1', false);
    rerender(
      <AgentPermissionCard
        onReply={onReply}
        tool={{ ...command, permissionRequested: true, status: 'denied' }}
      />,
    );
    const heading = screen.getByRole('heading', { name: 'Run this command?' });
    await waitFor(() => expectFocused(heading));
    expect(screen.getByRole('status').textContent).toBe('Denied');
  });

  it('shows the diff behind a file-change decision instead of raw arguments', async () => {
    const { container } = render(
      <AgentPermissionCard
        onReply={vi.fn(() => true)}
        tool={{
          id: 'edit-1',
          input: {
            file_path: '/library/Research/notes.md',
            new_string: 'Accepted: use Screely.',
            old_string: 'Undecided.',
          },
          kind: 'tool',
          name: 'Edit',
          permissionId: 'permission-2',
          permissionRequested: true,
          permissionTitle: null,
          status: 'awaiting',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Apply these changes?' })).not.toBeNull();
    expect(screen.queryByLabelText('Edit arguments')).toBeNull();
    expect(screen.getByRole('region', { name: 'Edited notes.md' })).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('.cm-deletedChunk')?.textContent).toContain('Undecided.'); // dom-contract: CodeMirror internals
      expect(container.querySelector('.cm-changedLine')?.textContent).toContain('Accepted'); // dom-contract: CodeMirror internals
    });
    expect(screen.getByRole('button', { name: 'Allow' })).not.toBeNull();
  });

  it('lists what settled work changed, with Open only for files inside the scope', async () => {
    const onOpenSource = vi.fn();
    render(
      <AgentActivityGroup
        onOpenSource={onOpenSource}
        sourceFor={(path) =>
          path.startsWith('/library/Research/')
            ? { folderPath: '/library/Research', path: path.slice('/library/Research/'.length) }
            : null
        }
        tools={[
          {
            id: 'write-1',
            input: { content: '# Plan', file_path: '/library/Research/plan.md' },
            kind: 'tool',
            name: 'Write',
            status: 'done',
          },
          {
            id: 'diff-1',
            input: { additions: 1, after: 'x\n', before: '', deletions: 0, path: 'notes.md' },
            kind: 'tool',
            name: 'FileDiff',
            status: 'done',
          },
          {
            id: 'write-2',
            input: { content: 'nope', file_path: '/library/Research/denied.md' },
            kind: 'tool',
            name: 'Write',
            status: 'denied',
          },
        ]}
      />,
    );

    const list = screen.getByRole('list', { name: 'Changed files' });
    expect(list.textContent).toContain('plan.md');
    expect(list.textContent).toContain('notes.md');
    expect(list.textContent).not.toContain('denied.md');
    expect(screen.queryByRole('button', { name: 'Open notes.md' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open plan.md' }));
    expect(onOpenSource).toHaveBeenCalledWith({ folderPath: '/library/Research', path: 'plan.md' });
    await userEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('button', { name: /Changed.*notes\.md.*Done/u })).not.toBeNull();
  });
});

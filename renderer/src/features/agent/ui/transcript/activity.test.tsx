import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { AgentActivityGroup, AgentPermissionCard } from './activity';
import type { AgentToolBlock } from './tool-presentation';

const command: AgentToolBlock = {
  id: 'tool-1',
  input: { command: 'pnpm test:agent' },
  kind: 'tool',
  name: 'Bash',
  status: 'running',
};

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
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const heading = screen.getByRole('heading', { name: 'Run this command?' });
    expect(heading).toBe(heading.ownerDocument.activeElement);
    expect(screen.getByRole('status').textContent).toBe('Denied');
  });
});

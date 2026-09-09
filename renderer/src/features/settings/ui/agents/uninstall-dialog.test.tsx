import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { agentRuntime } from '@/test/fakes/settings';

import { UninstallAgentDialog } from './uninstall-dialog';

afterEach(cleanup);

const claude = agentRuntime({ id: 'claude', label: 'Claude Code', ownership: 'managed' });

describe('UninstallAgentDialog', () => {
  it('stays closed until a runtime is under confirmation', () => {
    render(
      <UninstallAgentDialog
        runtime={null}
        failure={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        pending={false}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names the runtime and says what removing it costs before confirming', async () => {
    const onConfirm = vi.fn();
    render(
      <UninstallAgentDialog
        runtime={claude}
        failure={null}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        pending={false}
      />,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Uninstall Claude Code runtime?' });
    expect(dialog.textContent).toContain('chat ends now');
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Uninstall' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('keeps a failed removal inside the dialog rather than closing over the question', async () => {
    render(
      <UninstallAgentDialog
        runtime={claude}
        failure="Could not remove the managed install."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        pending={false}
      />,
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('alert').textContent).toBe(
      'Could not remove the managed install.',
    );
  });

  it('holds the cancel route shut while the removal is still running', async () => {
    const onCancel = vi.fn();
    render(
      <UninstallAgentDialog
        runtime={claude}
        failure={null}
        onCancel={onCancel}
        onConfirm={vi.fn()}
        pending
      />,
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
    await userEvent.setup().keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });
});

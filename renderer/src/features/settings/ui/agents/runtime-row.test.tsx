import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentRuntime } from '@/features/settings/domain/agent-catalog';
import type { FailureView } from '@/shared/domain/feature-error';
import { agentRuntime } from '@/test/fakes/settings';

import { RuntimeRow } from './runtime-row';

afterEach(cleanup);

function codex(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return agentRuntime({
    id: 'codex',
    installed: false,
    label: 'Codex',
    ownership: null,
    preparation: { kind: 'idle' },
    ...overrides,
  });
}

function renderRow(
  subject: AgentRuntime,
  options: { busy?: boolean; failure?: FailureView | null } = {},
) {
  const onAction = vi.fn();
  const onUninstall = vi.fn();
  render(
    <RuntimeRow
      busy={options.busy ?? false}
      failure={options.failure ?? null}
      onAction={onAction}
      onUninstall={onUninstall}
      runtime={subject}
    />,
  );
  return { onAction, onUninstall };
}

describe('RuntimeRow', () => {
  it('offers the single action its status derives, and hands it back on click', async () => {
    const subject = codex();
    const { onAction } = renderRow(subject);

    expect(screen.getByText('Not installed')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Install' }));

    expect(onAction).toHaveBeenCalledWith({ kind: 'install', label: 'Install' }, subject);
  });

  it('replaces the action with a preparing button while the runtime is busy', () => {
    renderRow(codex(), { busy: true });

    expect(screen.getByRole('button', { name: 'Preparing…' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('draws the staged track until a runtime is ready, then drops it', () => {
    renderRow(
      codex({
        installed: true,
        preparation: { kind: 'running', note: null, stage: 'configure' },
      }),
    );
    expect(screen.getByText('Configure')).not.toBeNull();

    cleanup();
    renderRow(codex({ installed: true, ownership: 'system', preparation: { kind: 'ready' } }));
    expect(screen.queryByText('Configure')).toBeNull();
    expect(screen.getByText('Ready for Chat · System runtime')).not.toBeNull();
  });

  it('keeps a command failure on the row it belongs to', () => {
    renderRow(codex(), {
      failure: { message: 'Installer exited with status 1.', tone: 'input' },
    });

    expect(screen.getByRole('alert').textContent).toBe('Installer exited with status 1.');
  });

  it('offers Uninstall only for an idle, managed install', async () => {
    const subject = codex({
      installed: true,
      ownership: 'managed',
      preparation: { kind: 'ready' },
    });
    const { onUninstall } = renderRow(subject);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Uninstall' }));
    expect(onUninstall).toHaveBeenCalledWith(subject);

    cleanup();
    renderRow(codex({ installed: true, ownership: 'system', preparation: { kind: 'ready' } }));
    expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull();
  });
});

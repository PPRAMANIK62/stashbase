import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentDebugControls } from '@/features/settings/domain/agent-catalog';
import type { AgentRuntimesViewModel } from '@/features/settings/hooks/use-agent-runtimes';

import { DebugBlock } from './debug-block';

afterEach(cleanup);

const enabledDebug: AgentDebugControls = {
  discoverySource: 'auto',
  nextSetupResult: 'none',
  nextTurnResult: 'none',
};

function viewModel(overrides: Partial<AgentRuntimesViewModel> = {}): AgentRuntimesViewModel {
  return {
    allowance: { allowance: null, failed: false },
    busy: () => false,
    catalog: { runtimes: [], debug: enabledDebug, failed: false, loading: false },
    debugBusy: false,
    debugFailure: null,
    failure: () => null,
    install: vi.fn(),
    login: vi.fn(),
    refreshAllowance: vi.fn(),
    refreshCatalog: vi.fn(),
    resetFirstRun: vi.fn(),
    uninstall: vi.fn(),
    uninstallFailure: () => null,
    uninstalling: () => false,
    updateDebug: vi.fn(),
    ...overrides,
  };
}

describe('DebugBlock', () => {
  it('renders nothing at all when the server withheld the debug state', () => {
    const { container } = render(
      <DebugBlock
        runtimes={viewModel({
          catalog: { runtimes: [], debug: null, failed: false, loading: false },
        })}
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('marks itself development-only and says what it will not touch', () => {
    render(<DebugBlock runtimes={viewModel()} />);

    expect(screen.getByText('Agent bootstrap testing')).not.toBeNull();
    expect(screen.getByText('Development only')).not.toBeNull();
    expect(screen.getByText(/never uninstall a global Agent/u)).not.toBeNull();
  });

  it('resets a runtime first run through the view model', async () => {
    const runtimes = viewModel();
    render(<DebugBlock runtimes={runtimes} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reset Codex first run' }));

    expect(runtimes.resetFirstRun).toHaveBeenCalledWith('codex');
  });

  it('holds every control while a debug write is open', () => {
    render(<DebugBlock runtimes={viewModel({ debugBusy: true })} />);

    expect(screen.getByRole('button', { name: 'Reset Claude first run' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows the failure the view model derived, not a fallback of its own', () => {
    render(
      <DebugBlock
        runtimes={viewModel({
          debugFailure: { message: 'StashBase is unavailable.', tone: 'capability' },
        })}
      />,
    );

    // An unreachable server reads as a quiet status, not an alert.
    expect(screen.getByRole('status').textContent).toBe('StashBase is unavailable.');
  });
});

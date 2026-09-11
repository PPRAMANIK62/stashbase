import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import type { CapturePort } from '@/features/settings/application/ports';
import { CAPTURE_APPLY_WARNING } from '@/features/settings/hooks/use-capture';
import type { SoftwareUpdateRow } from '@/shared/domain/software-update';
import { capturePort } from '@/test/fakes/settings';
import { withQueryClient } from '@/test/query';

import { GeneralPanel } from './general-panel';

afterEach(cleanup);

function renderPanel(
  port: CapturePort,
  applyWatch: (expected: boolean) => Promise<boolean>,
  softwareUpdate: SoftwareUpdateRow | null = null,
  onReportBug: (() => void) | null = null,
) {
  return withQueryClient(
    <GeneralPanel
      applyCaptureWatch={applyWatch}
      captureApi={port}
      onReportBug={onReportBug}
      softwareUpdate={softwareUpdate}
    />,
  );
}

function updateRow(overrides: Partial<SoftwareUpdateRow> = {}): SoftwareUpdateRow {
  return {
    autoCheckEnabled: false,
    busy: false,
    check: vi.fn(),
    failure: null,
    setAutoCheck: vi.fn(),
    status: 'StashBase is up to date.',
    version: '2.0.0',
    ...overrides,
  };
}

describe('GeneralPanel', () => {
  it('toggles the clipboard opt-in and reports a desktop apply mismatch', async () => {
    const port = capturePort();
    renderPanel(port, async () => false);
    const toggle = await screen.findByRole('switch', {
      name: 'Offer to add clipboard screenshots',
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.setup().click(toggle);
    await waitFor(() =>
      expect(port.update).toHaveBeenCalledWith(
        { clipboardImageImport: true },
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByRole('status')).toHaveProperty('textContent', CAPTURE_APPLY_WARNING);
    expect(screen.getByText('Knowledge capture')).not.toBeNull();
  });

  it('keeps a refused save visible instead of the apply warning', async () => {
    const port = capturePort({
      update: vi.fn(async () => {
        throw new Error('EPIPE');
      }),
    });
    renderPanel(port, async () => true);

    await userEvent
      .setup()
      .click(await screen.findByRole('switch', { name: 'Offer to add clipboard screenshots' }));

    // An unreachable capability is said quietly: there is nothing on this
    // screen for the reader to correct.
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      failureMessage('unavailable'),
    );
  });

  it('says nothing about updates in a build with no updater', async () => {
    renderPanel(capturePort(), async () => true);
    await screen.findByRole('switch', { name: 'Offer to add clipboard screenshots' });
    expect(screen.queryByText('Software updates')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check for updates' })).toBeNull();
  });

  it('names the running build, where it stands, and both update controls', async () => {
    const row = updateRow({ autoCheckEnabled: true });
    renderPanel(capturePort(), async () => true, row);

    expect(screen.getByText('StashBase 2.0.0')).not.toBeNull();
    expect(screen.getByText('StashBase is up to date.')).not.toBeNull();
    const auto = screen.getByRole('switch', { name: 'Check for updates automatically' });
    expect(auto.getAttribute('aria-checked')).toBe('true');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(row.check).toHaveBeenCalledOnce();
    await user.click(auto);
    expect(row.setAutoCheck).toHaveBeenCalledWith(false);
  });

  it('offers the bug report where the desktop can open it and says why where it cannot', async () => {
    const onReportBug = vi.fn();
    const desktop = renderPanel(capturePort(), async () => true, null, onReportBug);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Report a bug' }));
    expect(onReportBug).toHaveBeenCalledOnce();
    expect(screen.queryByText('Available in the desktop app.')).toBeNull();
    desktop.unmount();

    renderPanel(capturePort(), async () => true);
    const entry = await screen.findByRole('button', { name: 'Report a bug' });
    expect(entry.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Available in the desktop app.')).not.toBeNull();
  });

  it('locks both controls while the updater is already working', async () => {
    const row = updateRow({ busy: true, status: 'Looking for a new version…' });
    renderPanel(capturePort(), async () => true, row);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    await user.click(screen.getByRole('switch', { name: 'Check for updates automatically' }));
    expect(row.check).not.toHaveBeenCalled();
    expect(row.setAutoCheck).not.toHaveBeenCalled();
  });
});

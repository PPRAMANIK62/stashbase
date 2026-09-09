import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import type { CapturePort } from '@/features/settings/application/ports';
import { CAPTURE_APPLY_WARNING } from '@/features/settings/hooks/use-capture';
import { capturePort } from '@/test/fakes/settings';
import { withQueryClient } from '@/test/query';

import { GeneralPanel } from './general-panel';

afterEach(cleanup);

function renderPanel(port: CapturePort, applyWatch: (expected: boolean) => Promise<boolean>) {
  return withQueryClient(<GeneralPanel applyCaptureWatch={applyWatch} captureApi={port} />);
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
});

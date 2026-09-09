import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { CapturePort } from '@/features/settings/application/ports';
import { CAPTURE_APPLY_WARNING, useCapture } from '@/features/settings/hooks/use-capture';

import { GeneralPanel } from './general-panel';

afterEach(cleanup);

function renderPanel(port: CapturePort, applyWatch: (expected: boolean) => Promise<boolean>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper() {
    const capture = useCapture(port, applyWatch);
    return createElement(GeneralPanel, { capture });
  }
  return render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(Wrapper)),
  );
}

describe('GeneralPanel', () => {
  it('toggles the clipboard opt-in and reports a desktop apply mismatch', async () => {
    const port: CapturePort = {
      load: vi.fn(async () => ({ clipboardImageImport: false })),
      update: vi.fn(async (next) => next),
    };
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
});

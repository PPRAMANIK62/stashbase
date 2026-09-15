import { focusManager } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vite-plus/test';

import type { TelemetryPort } from '@/features/settings/application/telemetry-port';
import { TelemetryNotice } from '@/features/settings/ui/telemetry-notice';
import { withQueryClient } from '@/test/query';

import { TelemetryGroup } from './telemetry-group';

afterEach(cleanup);
function fixture() {
  let saved = { enabled: true, noticeSeen: false, available: true };
  const port: TelemetryPort = {
    load: async () => saved,
    update: vi.fn(async (change) => {
      saved = { ...saved, ...change };
      return saved;
    }),
  };
  return port;
}
it('persists opt-out and removes the first-launch notice without another confirmation', async () => {
  const port = fixture();
  withQueryClient(
    <>
      <TelemetryNotice port={port} />
      <TelemetryGroup port={port} onOpenExternal={() => undefined} />
    </>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Usage statistics' })).toBeNull(),
  );
  expect(port.update).toHaveBeenCalledWith(
    { enabled: false, noticeSeen: true },
    expect.any(AbortSignal),
  );
  expect(
    screen
      .getByRole('switch', { name: 'Share basic usage statistics' })
      .getAttribute('aria-checked'),
  ).toBe('false');
});
it('keeps the confirmed choice and explains a failed write', async () => {
  const port = fixture();
  port.update = async () => {
    throw new Error('Could not save');
  };
  withQueryClient(<TelemetryGroup port={port} onOpenExternal={() => undefined} />);
  const toggle = await screen.findByRole('switch', { name: 'Share basic usage statistics' });
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
  await userEvent.click(toggle);
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  expect(toggle.getAttribute('aria-checked')).toBe('true');
});
it('shows the event documentation and allows dismissing disclosure without changing collection', async () => {
  const port = fixture();
  const open = vi.fn();
  withQueryClient(
    <>
      <TelemetryNotice port={port} />
      <TelemetryGroup port={port} onOpenExternal={open} />
    </>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
  expect(open).toHaveBeenCalledWith(expect.stringContaining('usage-statistics.md'));
  await userEvent.click(await screen.findByRole('button', { name: 'Got it' }));
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Usage statistics' })).toBeNull(),
  );
  expect(port.update).toHaveBeenCalledWith({ noticeSeen: true }, expect.any(AbortSignal));
});

it('refreshes the durable choice when returning from another window', async () => {
  const port = fixture();
  withQueryClient(<TelemetryGroup port={port} onOpenExternal={() => undefined} />);
  const toggle = await screen.findByRole('switch', { name: 'Share basic usage statistics' });
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
  act(() => focusManager.setFocused(false));
  await port.update({ enabled: false }, new AbortController().signal);
  act(() => focusManager.setFocused(true));
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
  focusManager.setFocused(undefined);
});

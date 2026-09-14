import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { IDLE_ALLOWANCE } from '@/test/fakes/settings';

import { AllowanceRow } from './allowance-row';

afterEach(cleanup);

describe('AllowanceRow', () => {
  it('says the window has not started when the server reports no end date', () => {
    render(<AllowanceRow allowance={IDLE_ALLOWANCE} onRefresh={vi.fn()} />);

    expect(screen.getByText('100% remaining · Resets every 7 days from first use')).not.toBeNull();
  });

  it('clamps a nonsensical percentage into the bar it can actually draw', () => {
    render(
      <AllowanceRow
        allowance={{ ...IDLE_ALLOWANCE, remainingPercent: 148.6 }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(/^100% remaining/u)).not.toBeNull();
  });

  it('names the refill moment once the window has one', () => {
    render(
      <AllowanceRow
        allowance={{ ...IDLE_ALLOWANCE, windowEndsAt: '2026-09-08T00:00:00.000Z' }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(/Refills /u)).not.toBeNull();
  });

  it('refreshes on request and keeps the token breakdown behind a disclosure', async () => {
    const onRefresh = vi.fn();
    render(
      <AllowanceRow
        allowance={{ ...IDLE_ALLOWANCE, inputTokens: 1_200, outputTokens: 34 }}
        onRefresh={onRefresh}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalled();

    const summary = screen.getByText('Token usage');
    const disclosure = summary.closest('details') as HTMLDetailsElement;
    expect(disclosure.open).toBe(false);
    await user.click(summary);
    expect(disclosure.open).toBe(true);
    expect(screen.getByText('1,200 input · 34 output · 0 cached')).not.toBeNull();
  });
});

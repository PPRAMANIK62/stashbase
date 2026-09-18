import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectFocused } from '@/test/dom';

import { AgentRevisionCard } from './revision-card';

afterEach(cleanup);

describe('the Agent panel revision card', () => {
  it('says how much is left to decide and ends the whole review in one step', async () => {
    const acceptAll = vi.fn();
    const rejectAll = vi.fn();
    render(<AgentRevisionCard name="plan.md" review={{ acceptAll, pending: 3, rejectAll }} />);

    expect(screen.getByText('3 suggested changes')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(acceptAll).toHaveBeenCalledTimes(1);
    expect(rejectAll).not.toHaveBeenCalled();

    // The decision leaves no control behind, so focus goes to the heading
    // rather than to whatever the removed button was beside.
    const heading = screen.getByRole('heading', { name: 'Suggested changes in plan.md' });
    await waitFor(() => expectFocused(heading));
    expect(screen.getByRole('status').textContent).toBe('This review is no longer open here.');
  });

  it('refuses a second decision on the same card', async () => {
    const acceptAll = vi.fn();
    const rejectAll = vi.fn();
    const { rerender } = render(
      <AgentRevisionCard name="plan.md" review={{ acceptAll, pending: 1, rejectAll }} />,
    );

    expect(screen.getByText('1 suggested change')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reject all' }));
    rerender(<AgentRevisionCard name="plan.md" review={{ acceptAll, pending: 1, rejectAll }} />);
    expect(screen.queryByRole('button', { name: 'Reject all' })).toBeNull();
    expect(rejectAll).toHaveBeenCalledTimes(1);
  });

  it('offers no control for a review that is not open', () => {
    render(<AgentRevisionCard name="plan.md" review={null} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('This review is no longer open here.');
  });
});

/** The strip row: which sentence it says, and what each control it carries
 *  reaches. */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  UpdateNoticeOffer,
  UpdateNoticeViewModel,
} from '@/features/updates/hooks/use-update-notice';
import type { FailureView } from '@/shared/domain/feature-error';

import { UpdateNotice } from './update-notice';

afterEach(cleanup);

const AVAILABLE: UpdateNoticeOffer = {
  actionLabel: 'Download',
  message: 'StashBase 1.5.0 is available.',
  releasePageLabel: "What's new",
};

const UNREACHABLE: FailureView = {
  message: 'StashBase could not reach the updater.',
  tone: 'capability',
};

function mount(parts: Pick<UpdateNoticeViewModel, 'failure' | 'offer'>): UpdateNoticeViewModel {
  const notice: UpdateNoticeViewModel = {
    act: vi.fn(),
    dismiss: vi.fn(),
    openReleasePage: vi.fn(),
    ...parts,
  };
  render(<UpdateNotice notice={notice} />);
  return notice;
}

const controls = () => screen.queryAllByRole('button').map((button) => button.textContent);

describe('UpdateNotice', () => {
  it('says nothing when the window has neither an offer nor a refusal', () => {
    mount({ failure: null, offer: null });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(controls()).toEqual([]);
  });

  it('reads an offer as a status and routes each control it carries', async () => {
    const notice = mount({ failure: null, offer: AVAILABLE });

    expect(screen.getByRole('status').textContent).toContain(AVAILABLE.message);
    expect(controls()).toEqual(['Not now', "What's new", 'Download']);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    await user.click(screen.getByRole('button', { name: "What's new" }));

    expect(notice.act).toHaveBeenCalledOnce();
    expect(notice.dismiss).toHaveBeenCalledOnce();
    expect(notice.openReleasePage).toHaveBeenCalledOnce();
  });

  it('leaves only the dismissal for a phase that invites nothing', () => {
    mount({
      failure: null,
      offer: {
        actionLabel: null,
        message: 'Downloading StashBase 1.5.0… 64%',
        releasePageLabel: null,
      },
    });
    expect(screen.getByRole('status').textContent).toContain('Downloading StashBase 1.5.0… 64%');
    expect(controls()).toEqual(['Not now']);
  });

  it('says an unreachable updater quietly, in place of the offer sentence', () => {
    mount({ failure: UNREACHABLE, offer: AVAILABLE });

    const row = screen.getByRole('status');
    expect(row.textContent).toContain(UNREACHABLE.message);
    expect(row.textContent).not.toContain(AVAILABLE.message);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(controls()).toEqual(['Not now', "What's new", 'Download']);
  });

  it('carries no controls for a refusal with no offer behind it', () => {
    mount({ failure: UNREACHABLE, offer: null });
    expect(screen.getByRole('status').textContent).toBe(UNREACHABLE.message);
    expect(controls()).toEqual([]);
  });

  it('interrupts only for a refusal the reader could act on', () => {
    mount({ failure: { message: 'That folder is not writable.', tone: 'input' }, offer: null });
    expect(screen.getByRole('alert').textContent).toBe('That folder is not writable.');
  });
});

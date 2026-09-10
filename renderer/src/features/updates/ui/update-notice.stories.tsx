/** The strip row for each phase the window volunteers, plus the refusal a
 *  command can come back with. Storybook has no updater behind it, so every
 *  story hands the row a view model directly rather than the hook; the
 *  sentences and button words are the ones the phase table authors, so a story
 *  reads as the row a reader actually meets. */
import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  UpdateNoticeOffer,
  UpdateNoticeViewModel,
} from '@/features/updates/hooks/use-update-notice';
import type { FailureView } from '@/shared/domain/feature-error';

import { UpdateNotice } from './update-notice';

const noop = () => undefined;
const inert = { act: noop, dismiss: noop, openReleasePage: noop };

function offered(offer: UpdateNoticeOffer): UpdateNoticeViewModel {
  return { ...inert, failure: null, offer };
}

function refused(failure: FailureView): UpdateNoticeViewModel {
  return { ...inert, failure, offer: null };
}

const meta = {
  component: UpdateNotice,
  parameters: { controls: { disable: true }, fluidCanvas: { minHeight: '6rem', width: '52rem' } },
  title: 'Feedback/Update Notice',
} satisfies Meta<typeof UpdateNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full row: waving off, reading what changed, and taking it up. */
export const Available: Story = {
  args: {
    notice: offered({
      actionLabel: 'Download',
      message: 'StashBase 1.5.0 is available.',
      releasePageLabel: "What's new",
    }),
  },
};

/** Work already under way. Nothing to press, so the row is a sentence and the
 *  one way to stop hearing about it. */
export const Downloading: Story = {
  args: {
    notice: offered({
      actionLabel: null,
      message: 'Downloading StashBase 1.5.0… 64%',
      releasePageLabel: null,
    }),
  },
};

/** The only phase that asks for the window to go away, so it carries the
 *  action without a release route competing with it. */
export const ReadyToInstall: Story = {
  args: {
    notice: offered({
      actionLabel: 'Install and restart',
      message: 'StashBase 1.5.0 is ready to install.',
      releasePageLabel: null,
    }),
  },
};

/** Updating gave up. The row keeps a retry and a way to finish by hand. */
export const CouldNotFinish: Story = {
  args: {
    notice: offered({
      actionLabel: 'Try again',
      message: 'StashBase could not finish the update.',
      releasePageLabel: 'Open the release page',
    }),
  },
};

/** A refused command: the row reports it and offers nothing, because there is
 *  no phase behind a window that was not allowed to ask. */
export const Refused: Story = {
  args: {
    notice: refused({ message: 'StashBase could not reach the updater.', tone: 'capability' }),
  },
};

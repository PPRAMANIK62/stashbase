/** The sidebar card for each phase the window volunteers, plus the refusal a
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
const inert = { act: noop, dismiss: noop };

function offered(offer: UpdateNoticeOffer): UpdateNoticeViewModel {
  return { ...inert, failure: null, offer };
}

function refused(failure: FailureView): UpdateNoticeViewModel {
  return { ...inert, failure, offer: null };
}

const meta = {
  component: UpdateNotice,
  parameters: { controls: { disable: true }, fluidCanvas: { minHeight: '6rem', width: '16rem' } },
  title: 'Feedback/Update Notice',
} satisfies Meta<typeof UpdateNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The available-update card with a close icon and primary action. */
export const Available: Story = {
  args: {
    notice: offered({
      actionLabel: 'Update and restart',
      message: 'StashBase 1.5.0 is available.',
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
    }),
  },
};

/** The downloaded update offers installation and restart. */
export const ReadyToInstall: Story = {
  args: {
    notice: offered({
      actionLabel: 'Install and restart',
      message: 'StashBase 1.5.0 is ready to install.',
    }),
  },
};

/** Updating gave up. The card keeps its retry action. */
export const CouldNotFinish: Story = {
  args: {
    notice: offered({
      actionLabel: 'Try again',
      message: 'StashBase could not finish the update.',
    }),
  },
};

/** A refused command can be dismissed without taking any update action. */
export const Refused: Story = {
  args: {
    notice: refused({ message: 'StashBase could not reach the updater.', tone: 'capability' }),
  },
};

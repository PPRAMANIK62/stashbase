import type { Meta, StoryObj } from '@storybook/react-vite';
import { Copy, Pencil, RotateCcw } from 'lucide-react';

import { SizeProvider } from '@/lib/size-context';

import { ChatMessage } from './chat-message';

/** A deterministic stand-in for a dropped screenshot. `File` needs real bytes
 *  for the thumbnail's object URL, and a story must not depend on a fixture on
 *  disk. */
const attachment = new File([new Uint8Array([137, 80, 78, 71])], 'diagram.png', {
  type: 'image/png',
});

function MessageActions({ assistant = false }: { assistant?: boolean }) {
  const Action = assistant ? RotateCcw : Pencil;
  return (
    <>
      <button aria-label="Copy message" className="p-1" type="button">
        <Copy size={14} />
      </button>
      <button
        aria-label={assistant ? 'Regenerate response' : 'Edit message'}
        className="p-1"
        type="button"
      >
        <Action size={14} />
      </button>
    </>
  );
}

const meta = {
  title: 'Agent Patterns/Chat Message',
  component: ChatMessage,
  parameters: { fluidCanvas: { width: '42rem', minHeight: '32rem' }, layout: 'padded' },
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj;

export const Conversation: Story = {
  render: () => (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <ChatMessage actions={<MessageActions />} from="user" time="Today, 10:42">
        Which folders have the most unreviewed documents?
      </ChatMessage>
      <ChatMessage actions={<MessageActions assistant />} from="assistant">
        Research has 18 documents awaiting review. Planning has 6, and Design has 3.
      </ChatMessage>
    </div>
  ),
};

/** Attachments ride above the bubble as square thumbnails. A user turn can be
 *  attachments alone — with no text, the bubble is dropped entirely. */
export const WithAttachments: Story = {
  render: () => (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <ChatMessage files={[attachment]} from="user" time="Today, 11:04">
        Does this match the architecture we agreed?
      </ChatMessage>
      <ChatMessage files={[attachment]} from="user" time="Today, 11:05" />
    </div>
  ),
};

/** A long assistant reply, flush left with no bubble: the transcript's rhythm
 *  comes from the gap between turns rather than from a drawn frame. */
export const LongReply: Story = {
  render: () => (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <ChatMessage from="user" time="Today, 11:12">
        Summarise what changed this week.
      </ChatMessage>
      <ChatMessage actions={<MessageActions assistant />} from="assistant">
        Three folders changed. Research gained 12 documents, all Markdown, and every one of them is
        indexed. Planning lost two drafts that were merged into the quarterly report. Design is
        unchanged apart from a rename, which the index picked up without a re-run.
      </ChatMessage>
    </div>
  ),
};

/** The compact step: tighter bubble type and padding, for a narrow panel. */
export const Compact: Story = {
  render: () => (
    <SizeProvider size="compact">
      <div className="flex w-full max-w-xl flex-col gap-2">
        <ChatMessage actions={<MessageActions />} from="user" time="Today, 10:42">
          Which folders have the most unreviewed documents?
        </ChatMessage>
        <ChatMessage actions={<MessageActions assistant />} from="assistant">
          Research has 18 documents awaiting review.
        </ChatMessage>
      </div>
    </SizeProvider>
  ),
};

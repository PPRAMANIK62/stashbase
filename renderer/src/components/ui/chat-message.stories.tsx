import type { Meta, StoryObj } from '@storybook/react-vite';
import { Copy, Pencil, RotateCcw } from 'lucide-react';

import { ChatMessage } from './chat-message';

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

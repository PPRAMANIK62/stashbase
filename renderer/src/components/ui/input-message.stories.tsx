import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';

import { Button } from './button';
import { InputMessage } from './input-message';

function AttachFileButton({
  openFilePicker,
}: {
  openFilePicker: (acceptOverride?: string) => void;
}) {
  return (
    <Button
      aria-label="Attach files"
      onClick={() => openFilePicker()}
      size="icon-compact"
      variant="ghost"
    >
      <Paperclip />
    </Button>
  );
}

function ComposerExample() {
  const [value, setValue] = useState('');
  const [sent, setSent] = useState<{ id: number; message: string }[]>([]);
  return (
    <div className="w-full max-w-xl space-y-3">
      <InputMessage
        leftSlot={({ openFilePicker }) => <AttachFileButton openFilePicker={openFilePicker} />}
        onSend={(message) => {
          setSent((messages) => [...messages, { id: messages.length, message }]);
          setValue('');
        }}
        onValueChange={setValue}
        placeholderSuggestion="Summarize recent changes"
        suggestions={[
          'What changed this week?',
          'Find duplicate notes',
          'Show unprepared documents',
        ]}
        value={value}
      />
      {sent.map(({ id, message }) => (
        <p className="text-sm text-muted-foreground" key={id}>
          Sent: {message}
        </p>
      ))}
    </div>
  );
}

const meta = {
  title: 'Agent Patterns/Input Message',
  component: InputMessage,
  parameters: {
    controls: { disable: true },
    fluidCanvas: { width: '42rem', minHeight: '20rem' },
    layout: 'padded',
  },
} satisfies Meta<typeof InputMessage>;

export default meta;
type Story = StoryObj;

export const Composer: Story = { render: () => <ComposerExample /> };
export const Disabled: Story = {
  render: () => <InputMessage disabled onValueChange={() => undefined} value="" />,
};

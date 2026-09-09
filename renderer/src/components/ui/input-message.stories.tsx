import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';

import { SizeProvider } from '@/lib/size-context';

import { Button } from './button';
import type { InputMessageEditorContext } from './input-message';
import { InputMessage, type QueuedMessage } from './input-message';

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

/** Stands in for the consumer's rich field — the composer has no field of its
 *  own. Declared at module scope rather than inline so it is one component
 *  identity across renders, not a new one per keystroke. */
const editorSlot = (context: InputMessageEditorContext) => (
  <div
    aria-label={context.ariaLabel}
    className="outline-none"
    contentEditable={!context.disabled}
    onBlur={() => context.onFocusChange(false)}
    onFocus={() => context.onFocusChange(true)}
    onInput={(event) => context.onValueChange(event.currentTarget.textContent ?? '')}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      context.submit();
    }}
    role="textbox"
    tabIndex={0}
    style={{
      fontSize: context.metrics.fontSize,
      lineHeight: `${context.metrics.lineHeight}px`,
      minHeight: context.metrics.lineHeight * context.minRows,
      padding: `${context.metrics.paddingY}px ${context.metrics.paddingX}px`,
    }}
    suppressContentEditableWarning
  />
);

function ComposerExample() {
  const [value, setValue] = useState('');
  const [sent, setSent] = useState<{ id: number; message: string }[]>([]);
  return (
    <div className="w-full max-w-xl space-y-3">
      <InputMessage
        editor={editorSlot}
        leftSlot={AttachFileButton}
        onSend={(message) => {
          setSent((messages) => [...messages, { id: messages.length, message }]);
          setValue('');
        }}
        onValueChange={setValue}
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

/** The composer's chrome around a consumer-owned field: the attach button, the
 *  send control, and the surface that refocuses the field when clicked. */
export const Composer: Story = { render: () => <ComposerExample /> };

export const Disabled: Story = {
  render: () => (
    <InputMessage disabled editor={editorSlot} onValueChange={() => undefined} value="" />
  ),
};

/** The queue. While the assistant is streaming, submitting stages the draft
 *  instead of sending it: the row is draggable, double-click edits it back
 *  into the composer, and the top of the list is next to dispatch. */
function QueueExample() {
  const [value, setValue] = useState('');
  const [queue, setQueue] = useState<QueuedMessage[]>([
    { files: [], id: 'q1', text: 'Also list the folders that failed to index' },
    { files: [], id: 'q2', text: 'And how many documents each one holds' },
  ]);
  return (
    <div className="w-full max-w-xl">
      <InputMessage
        editor={editorSlot}
        onQueueChange={setQueue}
        onSend={() => setValue('')}
        onStop={() => undefined}
        onValueChange={setValue}
        queue={queue}
        status="streaming"
        value={value}
      />
    </div>
  );
}

export const Queued: Story = { render: () => <QueueExample /> };

/** The compact step: a denser composer for a narrow side panel. */
export const Compact: Story = {
  render: function Compact() {
    const [value, setValue] = useState('');
    return (
      <SizeProvider size="compact">
        <div className="w-full max-w-xl">
          <InputMessage
            editor={editorSlot}
            leftSlot={AttachFileButton}
            onValueChange={setValue}
            value={value}
          />
        </div>
      </SizeProvider>
    );
  },
};

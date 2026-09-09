import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { InputMessage, type InputMessageEditorContext } from './input-message';

afterEach(cleanup);

describe('InputMessage editor slot', () => {
  it('renders the consumer editor with the textarea metrics and submits through it', () => {
    const onSend = vi.fn();
    let context: InputMessageEditorContext | null = null;
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    render(
      <InputMessage
        editor={(ctx) => {
          context = ctx;
          return (
            <div
              contentEditable="true"
              data-testid="editor"
              role="textbox"
              aria-label={ctx.ariaLabel}
            />
          );
        }}
        files={[file]}
        onFilesChange={vi.fn()}
        onSend={onSend}
        onValueChange={vi.fn()}
        placeholder="Ask"
        value="Hello"
      />,
    );
    expect(screen.getByTestId('editor')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Message' })?.tagName).toBe('DIV');
    expect(context).toMatchObject({
      ariaLabel: 'Message',
      disabled: false,
      maxRows: 8,
      metrics: { fontSize: 14, lineHeight: 20, paddingX: 8, paddingY: 8 },
      minRows: 1,
      placeholder: 'Ask',
      value: 'Hello',
    });
    context!.submit();
    expect(onSend).toHaveBeenCalledWith('Hello', [file]);
  });
});

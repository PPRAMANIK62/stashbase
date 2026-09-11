import { cleanup, render, screen } from '@testing-library/react';
import { Copy } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { ChatMessage, ChatMessageAction } from './chat-message';

afterEach(cleanup);

describe('ChatMessage', () => {
  it('renders a user turn with its timestamp and actions', async () => {
    const view = render(
      <ChatMessage
        actions={
          <button aria-label="Copy message" type="button">
            Copy
          </button>
        }
        from="user"
        time="Today, 10:42"
      >
        Which folders have unreviewed documents?
      </ChatMessage>,
    );
    expect(screen.getByText('Today, 10:42')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeDefined();
    await expectNoA11yViolations(view.container);
  });

  it('renders an assistant turn with no meta row until it is given one', async () => {
    const view = render(
      <ChatMessage from="assistant">Research has 18 documents awaiting review.</ChatMessage>,
    );
    expect(screen.getByText('Research has 18 documents awaiting review.')).toBeDefined();
    expect(view.container.querySelector('.tabular-nums')).toBeNull();
    await expectNoA11yViolations(view.container);
  });

  it('keeps actions at the outer edge: after the time on a user row, before it on a reply', async () => {
    const view = render(
      <>
        <ChatMessage
          actions={<ChatMessageAction icon={Copy} label="Copy message" />}
          from="user"
          time="10:42 AM"
        >
          Which folders have unreviewed documents?
        </ChatMessage>
        <ChatMessage
          actions={<ChatMessageAction icon={Copy} label="Copy response" />}
          from="assistant"
          time="10:42 AM · 8s"
        >
          Research has 18 documents awaiting review.
        </ChatMessage>
      </>,
    );
    const userRow = screen.getByText('10:42 AM').parentElement;
    const replyRow = screen.getByText('10:42 AM · 8s').parentElement;
    expect(
      userRow?.lastElementChild?.contains(screen.getByRole('button', { name: 'Copy message' })),
    ).toBe(true);
    expect(
      replyRow?.firstElementChild?.contains(screen.getByRole('button', { name: 'Copy response' })),
    ).toBe(true);
    await expectNoA11yViolations(view.container);
  });
});

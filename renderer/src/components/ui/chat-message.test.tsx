import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { ChatMessage } from './chat-message';

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

  it('renders an assistant turn with no meta row of its own', async () => {
    const view = render(
      <ChatMessage from="assistant">Research has 18 documents awaiting review.</ChatMessage>,
    );
    // `time` is a user-message affordance and an assistant reply cannot be
    // given one — the props are discriminated on `from`, so the combination
    // this used to render-and-ignore does not compile.
    expect(screen.getByText('Research has 18 documents awaiting review.')).toBeDefined();
    expect(view.container.querySelector('.tabular-nums')).toBeNull();
    await expectNoA11yViolations(view.container);
  });
});

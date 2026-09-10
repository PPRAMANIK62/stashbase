import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { AgentMarkdown } from './markdown';

afterEach(cleanup);

describe('Agent Markdown', () => {
  it('renders structured GFM instead of exposing source punctuation', () => {
    render(
      <AgentMarkdown
        markdown={'**Useful**\n\n- First\n- Second\n\n[OpenAI](https://openai.com)'}
      />,
    );

    expect(screen.getByText('Useful').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const link = screen.getByRole('link', { name: 'OpenAI' });
    expect(link.getAttribute('href')).toBe('https://openai.com');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('keeps unsafe links and remote images inert', () => {
    const { container } = render(
      <AgentMarkdown
        markdown={'[Run](javascript:alert(1))\n\n![tracking](https://example.com/pixel.png)'}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Run' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toContain('Run');
  });

  it('routes external links through the owning desktop capability', async () => {
    const onOpenExternal = vi.fn();
    render(
      <AgentMarkdown
        markdown="[OpenAI](https://openai.com/codex/)"
        onOpenExternal={onOpenExternal}
      />,
    );

    await userEvent.click(screen.getByRole('link', { name: 'OpenAI' }));
    expect(onOpenExternal).toHaveBeenCalledWith('https://openai.com/codex/');
  });
});

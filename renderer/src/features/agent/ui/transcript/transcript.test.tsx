import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentTranscriptBlock } from '@/features/agent/domain/session';

import { AgentTranscript, copyableReplyIds } from './transcript';

const turn: AgentTranscriptBlock[] = [
  { id: 'u1', kind: 'user', text: 'Map the repo' },
  { id: 'a1', kind: 'assistant', text: 'I will read the orientation files first.' },
  { id: 'th1', kind: 'thinking', text: 'Listing top-level entries' },
  { id: 't1', input: { command: 'ls' }, kind: 'tool', name: 'Bash', status: 'done' },
  { id: 'a2', kind: 'assistant', text: 'It is a small learning library.' },
];

afterEach(cleanup);

function renderTranscript(blocks: AgentTranscriptBlock[], activeTurn: boolean) {
  return render(
    <AgentTranscript
      activeTurn={activeTurn}
      blocks={blocks}
      onOpenExternal={vi.fn()}
      onPermission={vi.fn(() => true)}
      onRetry={vi.fn(() => true)}
    />,
  );
}

describe('Agent transcript time cues', () => {
  it('shows a day divider only where consecutive prompts change day, and a hover time per prompt', () => {
    const now = Date.now();
    const yesterday = now - 86_400_000;
    renderTranscript(
      [
        { at: yesterday, id: 'u1', kind: 'user', text: 'Start' },
        { id: 'a1', kind: 'assistant', text: 'Sure.' },
        { at: now, id: 'u2', kind: 'user', text: 'Continue' },
        { id: 'a2', kind: 'assistant', text: 'Done.' },
      ],
      false,
    );
    const separators = screen.getAllByRole('separator');
    expect(separators.map((node) => node.getAttribute('aria-label'))).toEqual(['Today']);
    expect(
      screen.getByText(
        new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      ),
    ).not.toBeNull();
  });
});

describe('Agent transcript copy affordance', () => {
  it('marks only the closing reply of each settled turn', () => {
    expect([...copyableReplyIds(turn, true)]).toEqual([]);
    expect([...copyableReplyIds(turn, false)]).toEqual(['a2']);
    const twoTurns = [...turn, { id: 'u2', kind: 'user', text: 'Go on' } as const, turn[4]!];
    expect([...copyableReplyIds(twoTurns, true)]).toEqual(['a2']);
  });

  it('hides Copy while the turn streams and shows one afterwards', () => {
    const { rerender } = renderTranscript(turn, true);
    expect(screen.queryByRole('button', { name: 'Copy response' })).toBeNull();
    rerender(
      <AgentTranscript
        activeTurn={false}
        blocks={turn}
        onOpenExternal={vi.fn()}
        onPermission={vi.fn(() => true)}
        onRetry={vi.fn(() => true)}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Copy response' })).toHaveLength(1);
  });
});

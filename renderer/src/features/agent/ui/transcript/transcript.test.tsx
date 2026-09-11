import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentTranscriptBlock } from '@/features/agent/domain/session';
import { expectFocused } from '@/test/dom';

import { AgentTranscript, closingReplies } from './transcript';

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
    // Pinned, so the cue below is a literal the reader would see rather than
    // whatever the formatter happens to answer for the machine's clock.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 15, 30));
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
    expect(screen.getByText(/^3:30\s?PM$/u)).not.toBeNull();
    vi.useRealTimers();
  });

  it('shows when a settled reply finished and how long its turn took', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 15, 30));
    const now = Date.now();
    renderTranscript(
      [
        { at: now - 12_000, id: 'u1', kind: 'user', text: 'Start' },
        { at: now, id: 'a1', kind: 'assistant', text: 'Done.' },
      ],
      false,
    );
    expect(screen.getByText(/^3:30\s?PM · 12s$/u)).not.toBeNull();
    vi.useRealTimers();
  });
});

describe('Agent transcript permission decisions', () => {
  it('folds a decided ask into the activity group and moves focus to its summary', async () => {
    const onPermission = vi.fn(() => true);
    const ask: AgentTranscriptBlock = {
      id: 'tool-2',
      input: { content: '# Plan', file_path: '/library/Research/plan.md' },
      kind: 'tool',
      name: 'Write',
      permissionId: 'permission-1',
      permissionRequested: true,
      permissionTitle: null,
      status: 'awaiting',
    };
    const { rerender } = render(
      <AgentTranscript
        activeTurn
        blocks={[...turn.slice(0, 4), ask]}
        onOpenExternal={vi.fn()}
        onPermission={onPermission}
        onRetry={vi.fn(() => true)}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Apply these changes?' })).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onPermission).toHaveBeenCalledWith('tool-2', 'permission-1', false);
    rerender(
      <AgentTranscript
        activeTurn
        blocks={[...turn.slice(0, 4), { ...ask, permissionId: undefined, status: 'denied' }]}
        onOpenExternal={vi.fn()}
        onPermission={onPermission}
        onRetry={vi.fn(() => true)}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Apply these changes?' })).toBeNull();
    const summary = screen.getByRole('button', { expanded: false });
    expectFocused(summary);
    await userEvent.click(summary);
    expect(screen.getByRole('button', { name: /Wrote.*plan\.md.*Denied/u })).not.toBeNull();
    expect(screen.queryByRole('list', { name: 'Changed files' })).toBeNull();
  });
});

describe('Agent transcript copy affordance', () => {
  it('marks only the closing reply of each settled turn, with when its prompt went out', () => {
    expect([...closingReplies(turn, true)]).toEqual([]);
    expect([...closingReplies(turn, false)]).toEqual([['a2', undefined]]);
    const closing = turn[4];
    if (!closing) throw new Error('The fixture turn has no closing reply.');
    const twoTurns = [
      ...turn,
      { at: 1_000, id: 'u2', kind: 'user', text: 'Go on' } as const,
      { ...closing, id: 'a3' },
    ];
    expect([...closingReplies(twoTurns, true)]).toEqual([['a2', undefined]]);
    expect([...closingReplies(twoTurns, false)]).toEqual([
      ['a2', undefined],
      ['a3', 1_000],
    ]);
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

describe('Agent transcript prompt actions', () => {
  const twoTurns: AgentTranscriptBlock[] = [
    ...turn,
    { id: 'u2', kind: 'user', text: 'Go on' },
    { id: 'a3', kind: 'assistant', text: 'Sure.' },
  ];

  it('offers copy on every prompt and edit only on the latest one once its turn settles', async () => {
    const onEditPrompt = vi.fn();
    const transcript = (activeTurn: boolean) => (
      <AgentTranscript
        activeTurn={activeTurn}
        blocks={twoTurns}
        onEditPrompt={onEditPrompt}
        onOpenExternal={vi.fn()}
        onPermission={vi.fn(() => true)}
        onRetry={vi.fn(() => true)}
      />
    );
    const { rerender } = render(transcript(true));
    expect(screen.getAllByRole('button', { name: 'Copy message' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();

    rerender(transcript(false));
    const edit = screen.getAllByRole('button', { name: 'Edit message' });
    expect(edit).toHaveLength(1);
    await userEvent.click(edit[0] as HTMLElement);
    expect(onEditPrompt).toHaveBeenCalledWith('u2');
  });

  it('renders no edit control when nothing can take the prompt back', () => {
    renderTranscript(twoTurns, false);
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Copy message' })).toHaveLength(2);
  });
});

describe('Agent transcript context', () => {
  it('shows sent context as chips and file mentions inline', () => {
    renderTranscript(
      [
        {
          context: [
            {
              boundVersion: 3,
              format: 'md',
              kind: 'source',
              source: { folderPath: '/Library/Research', path: 'docs/a.md' },
            },
            {
              boundVersion: null,
              format: 'pdf',
              kind: 'source',
              source: { folderPath: '/Library/Research', path: 'docs/b.pdf' },
            },
            { kind: 'transient', name: 'shot.png', path: '/tmp/attach/shot.png' },
          ],
          id: 'u1',
          kind: 'user',
          text: 'Read @docs/a.md and /tmp/attach/shot.png please',
        },
      ],
      false,
    );
    // The mentioned source reads inline only; the dropped one and the upload
    // share the tile row above the bubble.
    const tiles = screen.getByRole('group', { name: 'Sent attachments' });
    expect(within(tiles).getByRole('img', { name: 'b.pdf' })).not.toBeNull();
    expect(within(tiles).queryByRole('img', { name: 'a.md' })).toBeNull();
    expect(within(tiles).getByRole('img', { name: 'shot.png' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/u })).toBeNull();
    expect(screen.getByText('(file mention: docs/a.md)', { exact: false })).not.toBeNull();
    expect(
      screen.getByText('(file mention: /tmp/attach/shot.png)', { exact: false }),
    ).not.toBeNull();
    const inline = screen.getByText('(file mention: docs/a.md)', { exact: false }).parentElement;
    expect(inline?.tagName).toBe('SPAN');
    expect(inline?.textContent).toContain('a.md');
  });

  it('rehydrates replayed attachments as tiles, with a server preview when one exists', () => {
    renderTranscript(
      [
        {
          attachments: [
            { name: 'report.pdf', path: '/Users/me/notes/report.pdf' },
            {
              name: 'shot.png',
              path: '/tmp/attach/shot.png',
              previewUrl: 'https://127.0.0.1:43123/api/agent/attachment-preview?path=x',
            },
          ],
          id: 'u1',
          kind: 'user',
          text: 'Summarise this',
        },
      ],
      false,
    );
    const tiles = screen.getByRole('group', { name: 'Sent attachments' });
    expect(within(tiles).getByRole('img', { name: 'report.pdf' })).not.toBeNull();
    expect(within(tiles).getByRole('img', { name: 'shot.png' }).getAttribute('src')).toContain(
      'attachment-preview',
    );
  });
});

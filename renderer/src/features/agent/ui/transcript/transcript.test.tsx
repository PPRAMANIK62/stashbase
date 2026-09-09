import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(summary).toBe(summary.ownerDocument.activeElement);
    await userEvent.click(summary);
    expect(screen.getByRole('button', { name: /Wrote.*plan\.md.*Denied/u })).not.toBeNull();
    expect(screen.queryByRole('list', { name: 'Changed files' })).toBeNull();
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

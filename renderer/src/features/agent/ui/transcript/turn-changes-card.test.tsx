import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentTurnChangedFile } from '@/features/agent/domain/session';

import { AgentTurnChangesCard } from './turn-changes-card';

afterEach(cleanup);

const folderPath = '/project/notes';
const files: AgentTurnChangedFile[] = [
  { additions: 3, change: 'edited', deletions: 1, path: `${folderPath}/drafts/plan.md` },
  { additions: 5, change: 'created', deletions: 0, path: `${folderPath}/summary.md` },
  { additions: 0, change: 'deleted', deletions: 4, path: `${folderPath}/old.md` },
];
const sourceFor = (path: string) =>
  path.startsWith(`${folderPath}/`)
    ? { folderPath, path: path.slice(folderPath.length + 1) }
    : null;

describe('the changed-in-this-turn card', () => {
  it('offers Review for an edit, Open for a new file and nothing for a deletion', async () => {
    const onReviewTurnChange = vi.fn();
    const onOpenSource = vi.fn();
    render(
      <AgentTurnChangesCard
        files={files}
        onOpenSource={onOpenSource}
        onReviewTurnChange={onReviewTurnChange}
        sourceFor={sourceFor}
        turnId="turn-1"
      />,
    );

    expect(screen.getByRole('region', { name: 'Changed in this turn' })).not.toBeNull();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Review changes to plan.md', 'Open summary.md']);
    expect(screen.getByText('Deleted')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Review changes to plan.md' }));
    expect(onReviewTurnChange).toHaveBeenCalledWith({
      source: { folderPath, path: 'drafts/plan.md' },
      turnId: 'turn-1',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Open summary.md' }));
    expect(onOpenSource).toHaveBeenCalledWith({ folderPath, path: 'summary.md' }, null);
  });

  it('offers no control for a file outside the chat folder', () => {
    render(
      <AgentTurnChangesCard
        files={[{ additions: 1, change: 'edited', deletions: 0, path: '/elsewhere/plan.md' }]}
        onReviewTurnChange={vi.fn()}
        sourceFor={sourceFor}
        turnId="turn-1"
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});

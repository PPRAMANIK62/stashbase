import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { AgentChangedFiles, AgentFileChangeView, fileChangeCounts } from './file-change';

afterEach(cleanup);

describe('Agent file change evidence', () => {
  it('counts added and removed lines the way the view chunks them', () => {
    expect(fileChangeCounts('one\ntwo\nthree\n', 'one\n2\nthree\nfour\n')).toEqual({
      additions: 2,
      deletions: 1,
    });
    expect(fileChangeCounts('', '# New\n')).toEqual({ additions: 1, deletions: 0 });
    expect(fileChangeCounts('same', 'same')).toEqual({ additions: 0, deletions: 0 });
  });

  it('renders a unified diff with the runtime text on both sides', async () => {
    const { container } = render(
      <AgentFileChangeView
        change={{
          action: 'edited',
          path: '/library/Research/notes.md',
          text: { after: 'alpha\nbeta\n', before: 'alpha\nbravo\n', extent: 'fragment' },
        }}
      />,
    );

    const section = screen.getByRole('region', { name: 'Edited notes.md' });
    expect(section.textContent).toContain('/library/Research');
    expect(screen.getByLabelText('1 added, 1 removed').textContent).toBe('+1−1');
    await waitFor(() => {
      expect(container.querySelector('.cm-deletedChunk')?.textContent).toContain('bravo');
      expect(container.querySelector('.cm-changedLine')?.textContent).toContain('beta');
    });
    expect(container.querySelector('.cm-lineNumbers')).toBeNull();
    expect(container.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false');
  });

  it('shows server counts, line numbers for whole files, and patches by marker', () => {
    const { container } = render(
      <>
        <AgentFileChangeView
          change={{
            action: 'changed',
            counts: { additions: 3, deletions: 2 },
            path: 'notes.md',
            text: { after: 'a\nb\n', before: 'a\n', extent: 'file' },
          }}
        />
        <AgentFileChangeView
          change={{
            action: 'edited',
            patch: '--- a/plan.md\n+++ b/plan.md\n@@ -1 +1 @@\n-old\n+new\n context\n',
            path: 'plan.md',
          }}
        />
      </>,
    );

    expect(screen.getByLabelText('3 added, 2 removed').textContent).toBe('+3−2');
    expect(container.querySelector('.cm-lineNumbers')).not.toBeNull();
    const patch = screen.getByLabelText('Edited plan.md patch');
    const kinds = [...patch.querySelectorAll('[data-line]')].map((row) =>
      row.getAttribute('data-line'),
    );
    expect(kinds).toEqual(['meta', 'meta', 'meta', 'del', 'add', 'ctx']);
  });

  it('lists changed files once and offers Open only for workspace sources', async () => {
    const onOpenSource = vi.fn();
    render(
      <AgentChangedFiles
        changes={[
          { action: 'wrote', path: '/library/Research/notes/plan.md' },
          { action: 'edited', path: '/elsewhere/config.json' },
        ]}
        onOpenSource={onOpenSource}
        sourceFor={(path) =>
          path.startsWith('/library/Research/')
            ? { folderPath: '/library/Research', path: path.slice('/library/Research/'.length) }
            : null
        }
      />,
    );

    const list = screen.getByRole('list', { name: 'Changed files' });
    expect(list.textContent).toContain('plan.md');
    expect(list.textContent).toContain('Wrote');
    expect(list.textContent).toContain('config.json');
    expect(screen.queryByRole('button', { name: 'Open config.json' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open plan.md' }));
    expect(onOpenSource).toHaveBeenCalledWith({
      folderPath: '/library/Research',
      path: 'notes/plan.md',
    });
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { ConfirmDialog } from './confirm-dialog';

afterEach(cleanup);

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      confirmLabel="Delete"
      description="This cannot be undone."
      onCancel={onCancel}
      onConfirm={onConfirm}
      open
      title="Delete file?"
      {...props}
    />,
  );
  return { onCancel, onConfirm };
}

describe('ConfirmDialog', () => {
  it('names and describes the question', async () => {
    renderDialog();
    const panel = await screen.findByRole('dialog', { name: 'Delete file?' });
    expect(panel.textContent).toContain('This cannot be undone.');
    await waitFor(() => expectNoA11yViolations(document.body));
  });

  it('reports the choice the reader made', async () => {
    const { onCancel, onConfirm } = renderDialog();
    await screen.findByRole('dialog', { name: 'Delete file?' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps a refusal inside the panel', async () => {
    renderDialog({ failure: 'That folder is read-only.' });
    await screen.findByRole('dialog', { name: 'Delete file?' });
    expect(screen.getByRole('alert').textContent).toBe('That folder is read-only.');
  });

  it('cannot be dismissed or re-run while the action is in flight', async () => {
    const { onCancel, onConfirm } = renderDialog({ pending: true });
    await screen.findByRole('dialog', { name: 'Delete file?' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Delete file?' })).toBeTruthy());
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows the extra detail a question carries', async () => {
    renderDialog({ details: <p>/library/notes/draft.md</p> });
    const panel = await screen.findByRole('dialog', { name: 'Delete file?' });
    expect(panel.textContent).toContain('/library/notes/draft.md');
  });
});

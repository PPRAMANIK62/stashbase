import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { QuickOpenSource } from '@/features/retrieval/domain/quick-open';

import ManagedQuickOpen from './managed-quick-open';
import type { QuickOpenProps } from './quick-open-types';

const sources: QuickOpenSource[] = [
  {
    action: 'open',
    retrievalAccess: 'included',
    source: { folderPath: '/library/notes', path: 'notes/plan.md' },
  },
  {
    action: 'reveal',
    retrievalAccess: 'excluded',
    source: { folderPath: '/library/notes', path: 'linked/report.bin' },
  },
];

function renderPicker(overrides: Partial<QuickOpenProps> = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onNavigate = overrides.onNavigate ?? vi.fn(async () => true);
  const onRetry = overrides.onRetry ?? vi.fn();
  return {
    onClose,
    onNavigate,
    onRetry,
    ...render(
      <ManagedQuickOpen
        folderName="Notes"
        onClose={onClose}
        onNavigate={onNavigate}
        onRetry={onRetry}
        open
        revealLabel="Show in file manager"
        sources={sources}
        status="ready"
        {...overrides}
      />,
    ),
  };
}

afterEach(cleanup);

describe('Quick Open picker', () => {
  it('waits for the file list and offers a retry when it cannot be read', async () => {
    const { onRetry, rerender } = renderPicker({ sources: [], status: 'loading' });
    expect(screen.getByRole('status').textContent).toBe('Loading files…');

    rerender(
      <ManagedQuickOpen
        folderName="Notes"
        onClose={vi.fn()}
        onNavigate={vi.fn(async () => true)}
        onRetry={onRetry}
        open
        revealLabel="Show in file manager"
        sources={[]}
        status="unavailable"
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe('Files are unavailable.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('separates an empty folder from a query that matches nothing', async () => {
    renderPicker({ sources: [] });
    expect(screen.getByRole('status').textContent).toBe('This folder has no files.');

    cleanup();
    renderPicker();
    await userEvent.setup().type(screen.getByRole('combobox', { name: 'Search files' }), 'zzz');

    expect(screen.getByRole('status').textContent).toBe('No matching files.');
  });

  it('names the reveal that failed and keeps the picker open', async () => {
    const { onClose } = renderPicker({ onNavigate: vi.fn(async () => false) });

    await userEvent.setup().click(screen.getByRole('option', { name: /report\.bin, linked/u }));

    expect(screen.getByRole('alert').textContent).toBe('Could not show in file manager.');
    expect(screen.getByRole('dialog', { name: 'Open file' })).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports a rejected navigation without leaking its cause', async () => {
    renderPicker({
      onNavigate: vi.fn(async () => {
        throw new Error('EACCES: /library/notes/notes/plan.md');
      }),
    });

    await userEvent.setup().click(screen.getByRole('option', { name: 'plan.md, notes' }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(
      'Could not open this file. Your current document remains available.',
    );
    expect(alert.textContent).not.toContain('EACCES');
  });
});

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { QuickOpenSource } from '@/features/retrieval/domain/quick-open';

import { QuickOpen } from './quick-open';

const sources: QuickOpenSource[] = [
  {
    action: 'open',
    retrievalAccess: 'included',
    source: { folderPath: '/library/notes', path: 'notes/plan.md' },
  },
  {
    action: 'open',
    retrievalAccess: 'excluded',
    source: { folderPath: '/library/notes', path: 'archive/report.bin' },
  },
  {
    action: 'reveal',
    retrievalAccess: 'excluded',
    source: { folderPath: '/library/notes', path: 'linked/report.bin' },
  },
];

function renderQuickOpen(onNavigate = vi.fn(async () => true), onClose = vi.fn()) {
  return {
    onClose,
    onNavigate,
    ...render(
      <QuickOpen
        folderName="Notes"
        onClose={onClose}
        onNavigate={onNavigate}
        onRetry={vi.fn()}
        open
        revealLabel="Show in file manager"
        sources={sources}
        status="ready"
      />,
    ),
  };
}

let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

describe('Quick Open', () => {
  it('renders a controlled lazy picker and focuses its query field', async () => {
    renderQuickOpen();
    const picker = await screen.findByRole('dialog', { name: 'Open file' }, { timeout: 5_000 });
    expect(picker.className).toContain('top-16');
    expect(screen.queryByText('Quick Open')).toBeNull();
    expect(screen.queryByText(/Search files in/u)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.getByPlaceholderText('Open file…')).not.toBeNull();
    expect(globalThis.document.activeElement).toBe(
      screen.getByRole('combobox', { name: 'Search files' }),
    );
  });

  it('searches paths, exposes generic-file context, and emits the selected typed intent', async () => {
    const { onNavigate } = renderQuickOpen();
    const user = userEvent.setup();

    const input = await screen.findByRole('combobox', { name: 'Search files' }, { timeout: 5_000 });
    await user.type(input, 'report');

    const openResult = screen.getByRole('option', {
      name: 'report.bin, archive, excluded from Search and automatic Chat context',
    });
    const revealResult = screen.getByRole('option', {
      name: 'report.bin, linked, excluded from Search and automatic Chat context, Show in file manager',
    });
    expect(openResult.getAttribute('aria-selected')).toBe('true');
    expect(revealResult.getAttribute('aria-selected')).toBe('false');

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'reveal-source',
      source: { folderPath: '/library/notes', path: 'linked/report.bin' },
    });
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('keeps the picker open with actionable context when navigation is rejected', async () => {
    renderQuickOpen(vi.fn(async () => false));

    await userEvent
      .setup()
      .click(await screen.findByRole('option', { name: 'plan.md, notes' }, { timeout: 5_000 }));

    expect(screen.getByRole('dialog', { name: 'Open file' })).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('current document remains available');
  });

  it('supports first, last, and paged keyboard movement without leaving the query', async () => {
    const { onNavigate } = renderQuickOpen();
    const user = userEvent.setup();
    const input = await screen.findByRole('combobox', { name: 'Search files' }, { timeout: 5_000 });

    await user.keyboard('{End}{Home}{PageDown}{Enter}');

    expect(globalThis.document.activeElement).toBe(input);
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'reveal-source',
      source: { folderPath: '/library/notes', path: 'linked/report.bin' },
    });
  });

  it('reveals the complete list inset at both keyboard scroll boundaries', async () => {
    renderQuickOpen();
    const user = userEvent.setup();
    const input = await screen.findByRole('combobox', { name: 'Search files' }, { timeout: 5_000 });
    const results = screen.getByRole('listbox', { name: 'Quick Open results' });
    const scrollTo = vi.fn();
    Object.defineProperties(results, {
      scrollHeight: { configurable: true, value: 144 },
      scrollTo: { configurable: true, value: scrollTo },
    });

    await user.keyboard('{End}');
    await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ top: 144 }));

    await user.keyboard('{Home}');
    await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ top: 0 }));
    expect(globalThis.document.activeElement).toBe(input);
  });
});

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createDocumentTabsRuntime,
  type DocumentTabsRuntime,
} from '@/features/documents/application/tabs-runtime';
import type { DocumentHeading } from '@/features/documents/domain/outline';
import { documentTabsRuntimeOptions } from '@/test/fakes/documents';

import { DocumentOutline } from './outline';

const FOLDER = '/library/notes';
const PLAN: DocumentHeading = { id: 'plan', level: 1, position: 1, text: 'Plan' };
const DETAILS: DocumentHeading = { id: 'details', level: 2, position: 8, text: 'Details' };
const UNTITLED: DocumentHeading = { id: 'blank', level: 1, position: 20, text: '' };

const runtimes: DocumentTabsRuntime[] = [];

/** A tabs runtime holding `paths` as open documents, the first one active. */
function createRuntime(paths: readonly string[] = ['report.md']): DocumentTabsRuntime {
  const tabs = paths.map((path, index) => ({
    id: `tab-${index + 1}`,
    source: { folderPath: FOLDER, path },
  }));
  const runtime = createDocumentTabsRuntime(
    documentTabsRuntimeOptions({
      folderPath: FOLDER,
      ...(tabs[0] ? { restored: { activeTabId: tabs[0].id, tabs } } : {}),
    }),
  );
  runtimes.push(runtime);
  return runtime;
}

/** Publishes `headings` as the active tab's outline and answers with the spy
 *  the outline calls when a heading is picked. */
function publish(
  runtime: DocumentTabsRuntime,
  headings: DocumentHeading[],
  activeId: string | null = null,
) {
  const tabId = runtime.store.getState().activeTabId ?? '';
  const owner = Symbol('outline-test');
  const select = vi.fn();
  act(() => {
    runtime.navigation.claimOutline(tabId, owner);
    runtime.navigation.publishOutline(tabId, owner, { activeId, headings }, select);
  });
  return select;
}

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

describe('document outline states', () => {
  it('has nothing to outline when no document is open', () => {
    render(<DocumentOutline runtime={createRuntime([])} />);

    expect(screen.getByLabelText('Document outline section')).not.toBeNull();
    expect(screen.getByText('No outline available')).not.toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('reads as waiting for a format that does publish headings', () => {
    render(<DocumentOutline runtime={createRuntime(['report.md'])} />);

    expect(screen.getByLabelText('report.md outline, unavailable')).not.toBeNull();
    expect(screen.getByText('No outline available for this document')).not.toBeNull();
  });

  it('says so plainly for a format that never publishes headings', () => {
    render(<DocumentOutline runtime={createRuntime(['config.json'])} />);

    expect(
      screen.getByLabelText('config.json outline, not available for this file type'),
    ).not.toBeNull();
    expect(screen.getByText('No outline available for this document')).not.toBeNull();
  });

  it('separates a document with no headings from one whose outline never arrived', () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    publish(runtime, []);
    rerender(<DocumentOutline runtime={runtime} />);

    expect(screen.getByLabelText('report.md outline, 0 headings')).not.toBeNull();
    expect(screen.getByText('No headings in this document')).not.toBeNull();
    expect(screen.queryByText('No outline available for this document')).toBeNull();
  });

  it('counts one heading in the singular and several in the plural', () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);

    publish(runtime, [PLAN]);
    rerender(<DocumentOutline runtime={runtime} />);
    expect(screen.getByLabelText('report.md outline, 1 heading')).not.toBeNull();

    publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);
    expect(screen.getByLabelText('report.md outline, 2 headings')).not.toBeNull();
  });
});

describe('document outline tree', () => {
  it('nests a heading under its parent and marks where the reader is', () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    publish(runtime, [PLAN, DETAILS], DETAILS.id);
    rerender(<DocumentOutline runtime={runtime} />);

    const nav = screen.getByRole('navigation', { name: 'Document outline' });
    // The nesting wrapper is the app's own structural marker for the heading
    // hierarchy; it carries no role or label of its own.
    expect(nav.querySelector('[data-sidebar="menu-sub"]')).not.toBeNull(); // dom-contract: see comment above
    const child = screen.getByRole('button', { name: 'Heading level 2: Details' });
    expect(child.getAttribute('aria-current')).toBe('location');
    expect(
      screen.getByRole('button', { name: 'Heading level 1: Plan' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('names an untitled section rather than showing an empty row', () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    publish(runtime, [UNTITLED]);
    rerender(<DocumentOutline runtime={runtime} />);

    const row = screen.getByRole('button', { name: 'Heading level 1: Untitled section' });
    expect(row.title).toBe('Untitled section');
  });

  it('sends the picked heading back to the document', async () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    const select = publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);

    await userEvent.click(screen.getByRole('button', { name: 'Heading level 2: Details' }));
    expect(select).toHaveBeenCalledWith(DETAILS);
  });

  it('offers a disclosure only to a heading that has children', () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);

    const toggle = screen.getByRole('button', { name: 'Collapse Plan' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: /^(?:Collapse|Expand) Details$/u })).toBeNull();
  });
});

describe('document outline collapse', () => {
  it('hides and restores a subtree from its own control', async () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Collapse Plan' }));
    expect(screen.queryByRole('button', { name: 'Heading level 2: Details' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand Plan' }).getAttribute('aria-expanded')).toBe(
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Expand Plan' }));
    expect(screen.getByRole('button', { name: 'Heading level 2: Details' })).not.toBeNull();
  });

  it('opens every subtree again when the reader moves to another document', async () => {
    const runtime = createRuntime(['report.md', 'other.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Plan' }));

    await act(async () => {
      await runtime.activate('tab-2');
    });
    publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);

    expect(screen.getByLabelText('other.md outline, 2 headings')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse Plan' })).not.toBeNull();
  });

  it('forgets a collapsed heading the document no longer publishes', async () => {
    const runtime = createRuntime(['report.md']);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);
    publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Plan' }));

    publish(runtime, [UNTITLED]);
    rerender(<DocumentOutline runtime={runtime} />);
    publish(runtime, [PLAN, DETAILS]);
    rerender(<DocumentOutline runtime={runtime} />);

    expect(screen.getByRole('button', { name: 'Collapse Plan' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Heading level 2: Details' })).not.toBeNull();
  });
});

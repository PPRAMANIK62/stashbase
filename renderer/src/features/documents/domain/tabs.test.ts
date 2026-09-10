import { describe, expect, it } from 'vite-plus/test';

import {
  activateDocumentTab,
  closeDocumentTab,
  createDocumentTabsState,
  openDocumentTab,
  type DocumentTabsState,
} from './tabs';

const notes = { folderPath: '/library/notes', path: 'plan.md' };

/** The invariant every transition below has to leave standing. */
const isConsistent = (state: DocumentTabsState) =>
  state.activeTabId === null || state.tabs.some((tab) => tab.id === state.activeTabId);

describe('document tabs', () => {
  it('restores only one tab per exact source and retains distinct folders', () => {
    const state = createDocumentTabsState({
      activeTabId: 'duplicate',
      tabs: [
        { id: 'notes', source: notes },
        { id: 'duplicate', source: { ...notes } },
        {
          id: 'archive',
          source: { folderPath: '/library/archive', path: 'plan.md' },
        },
      ],
    });

    expect(state.tabs.map((tab) => tab.id)).toEqual(['notes', 'archive']);
    expect(state.activeTabId).toBe('notes');
  });

  it('opens an existing source by activation instead of duplicating it', () => {
    let state = createDocumentTabsState();
    state = openDocumentTab(state, { id: 'first', source: notes });
    state = openDocumentTab(state, {
      id: 'second',
      source: { folderPath: '/library/notes', path: 'other.md' },
    });
    state = openDocumentTab(state, { id: 'duplicate', source: { ...notes } });

    expect(state.tabs.map((tab) => tab.id)).toEqual(['first', 'second']);
    expect(state.activeTabId).toBe('first');
  });

  it('activates known tabs and selects the adjacent tab after close', () => {
    let state = createDocumentTabsState({
      activeTabId: 'one',
      tabs: [
        { id: 'one', source: notes },
        {
          id: 'two',
          source: { folderPath: '/library/notes', path: 'two.md' },
        },
        {
          id: 'three',
          source: { folderPath: '/library/notes', path: 'three.md' },
        },
      ],
    });

    state = activateDocumentTab(state, 'two');
    state = closeDocumentTab(state, 'two');
    expect(state.activeTabId).toBe('three');
    state = closeDocumentTab(state, 'three');
    expect(state.activeTabId).toBe('one');
  });
  it('keeps the active tab a member of the tab set through every transition', () => {
    const two = { folderPath: '/library/notes', path: 'two.md' };
    // A restored active id that names no surviving tab is dropped, not kept.
    let state = createDocumentTabsState({
      activeTabId: 'missing',
      tabs: [{ id: 'one', source: notes }],
    });
    expect(state.activeTabId).toBeNull();
    expect(isConsistent(state)).toBe(true);

    // Activating an unknown tab leaves the previous member active.
    state = openDocumentTab(state, { id: 'two', source: two });
    state = activateDocumentTab(state, 'unknown');
    expect(state.activeTabId).toBe('two');
    expect(isConsistent(state)).toBe(true);

    // Closing the last tab leaves no dangling active id behind.
    state = closeDocumentTab(state, 'two');
    state = closeDocumentTab(state, 'one');
    expect(state.tabs).toEqual([]);
    expect(state.activeTabId).toBeNull();
    expect(isConsistent(state)).toBe(true);
  });
});

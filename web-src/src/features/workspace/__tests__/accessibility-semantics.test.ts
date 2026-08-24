/**
 * Role, name, and selection semantics for the two workspace navigation
 * surfaces — the tab strip and the file tree — asserted by rendering them.
 * These are the assertions that let the `jsx-a11y` lint rules stay warnings
 * (see `code-review/renderer-architecture.md`), so they cover this feature's
 * surfaces only; other features assert their own.
 */
import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { appActions as stubActions, appState, mountApp, withDom } from '@/common/__tests__/renderHarness';
import { FileTree } from '@/features/workspace/components/FileTree';
import { TabStrip } from '@/features/workspace/components/TabStrip';
import { AppProviders, type AppActions } from '@/store/contexts/AppContext';
import { initialState, makeTab, toNameSet, type Action, type State } from '@/store/state/state';

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function actions(overrides: Partial<AppActions> = {}): AppActions {
  return new Proxy(overrides, {
    get: (target, property) => property in target ? target[property as keyof AppActions] : async () => undefined,
  }) as AppActions;
}

async function renderWithState(
  state: State,
  child: React.ReactElement,
  appActions: AppActions = actions(),
  dispatch: (action: Action) => void = () => undefined,
): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(
      AppProviders,
      { state, actions: appActions, dispatch, children: child },
    ));
  });
  return renderer!;
}

function byRole(root: ReactTestInstance, role: string): ReactTestInstance[] {
  return root.findAll((node) => node.props.role === role);
}

/**
 * The tab strip is asserted against a real DOM rather than against React
 * props: it moves focus by id and reads `document.activeElement`, which a
 * renderer with no elements cannot answer. This is also the test that holds
 * the strip's keyboard contract in place — the strip stays off the shared
 * `Tabs` primitive for bundle reasons (see `TabStrip.tsx`), so nothing else
 * guarantees it behaves like the tab sets that are on it.
 */
test('document tabs expose their selected tab and named close action', async () => {
  const first = makeTab();
  first.file = { name: 'First.md', format: 'md', content: '' };
  const second = makeTab();
  second.file = { name: 'Second.md', format: 'md', content: '' };

  await withDom(async (dom) => {
    const activated: string[] = [];
    await mountApp(dom, createElement(TabStrip), {
      state: appState({ workspace: { tabs: [first, second], activeTabId: first.id } }),
      actions: stubActions({ activateTab: async (id) => { activated.push(id); } }),
    });

    assert.equal(dom.byRole('tablist')[0]?.getAttribute('aria-label'), 'Open documents');
    const tabs = dom.byRole('tab');
    assert.deepEqual(tabs.map((tab) => tab.getAttribute('aria-selected')), ['true', 'false']);
    // Roving tabindex: one tab stop for the whole strip.
    assert.deepEqual(tabs.map((tab) => tab.tabIndex), [0, -1]);
    // Every tab points at the ONE panel MainPane renders, which names the
    // active tab back through this id — not at a per-tab panel.
    assert.deepEqual(tabs.map((tab) => tab.getAttribute('aria-controls')), ['document-panel', 'document-panel']);
    assert.deepEqual(tabs.map((tab) => tab.id), [`document-tab-${first.id}`, `document-tab-${second.id}`]);
    assert.equal(dom.byLabel('Close First.md').length, 1);
    // The New-tab control is deliberately NOT one of the tabs.
    assert.equal(dom.byRole('tablist')[0]?.contains(dom.byLabel('New tab')[0]), false);

    await dom.fire(tabs[1], new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.deepEqual(activated, [second.id]);

    // Moving the caret SELECTS as it goes, matching the chat session strip
    // (which opts into Base UI's `activateOnFocus`; the primitive does not
    // default it, and Settings deliberately leaves it off). This strip is
    // hand-rolled, so this assertion is the only thing holding it to that.
    activated.length = 0;
    tabs[0].focus();
    await dom.fire(tabs[0], new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.deepEqual(activated, [second.id]);
  });
});

test('file explorer exposes expandable and selected items plus named edit fields', async () => {
  const base = {
    ...initialState,
    workspace: {
      ...initialState.workspace,
      folderPath: '/workspace',
      folders: [{ path: 'Guides' }],
      files: [{ name: 'note.md', format: 'md' }],
      expanded: toNameSet(['Guides']),
      selectedPath: 'note.md',
    },
  } as State;
  let renderer = await renderWithState(base, createElement(FileTree));
  assert.equal(byRole(renderer.root, 'tree')[0]?.props['aria-label'], 'Files');
  const items = byRole(renderer.root, 'treeitem');
  const folder = items.find((item) => item.props['aria-label'] === 'Guides');
  const selectedFile = items.find((item) => item.props['aria-label'] === 'note.md');
  assert.equal(folder?.props['aria-expanded'], true);
  assert.equal(folder?.props.tabIndex, -1);
  assert.equal(selectedFile?.props['aria-selected'], true);
  assert.equal(selectedFile?.props.tabIndex, 0);

  const guideRow = items.find((item) => item.props['aria-label'] === 'Guides');
  await act(async () => guideRow?.props.onFocus());
  const movedItems = byRole(renderer.root, 'treeitem');
  assert.equal(movedItems.find((item) => item.props['aria-label'] === 'Guides')?.props.tabIndex, 0);
  assert.equal(movedItems.find((item) => item.props['aria-label'] === 'note.md')?.props.tabIndex, -1);
  await act(async () => renderer.unmount());

  renderer = await renderWithState({
    ...base,
    uiShell: { ...base.uiShell, renaming: { path: 'note.md', kind: 'file' } },
  }, createElement(FileTree));
  const rename = renderer.root.findAll((node) => node.type === 'input' && node.props['aria-label'] === 'Rename file note.md');
  assert.equal(rename.length, 1);
  await act(async () => renderer.unmount());

  renderer = await renderWithState({
    ...base,
    workspace: { ...base.workspace, activeFolder: '', newFolderInputOpen: true },
  }, createElement(FileTree));
  const createFolder = renderer.root.findAll((node) => node.type === 'input' && node.props['aria-label'] === 'New folder in folder root');
  assert.equal(createFolder.length, 1);
  await act(async () => renderer.unmount());
});

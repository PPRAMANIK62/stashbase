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
import { act as domAct } from 'react';
import { appActions as stubActions, appState, mountApp, withDom } from '@/common/__tests__/renderHarness';
import { FileTree } from '@/features/workspace/components/FileTree';
import { MoveFilePicker } from '@/features/workspace/components/MoveFilePicker';
import { openMoveFilePicker } from '@/features/workspace/lib/moveFilePickerTrigger';
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
    const closed: string[] = [];
    const dispatched: unknown[] = [];
    await mountApp(dom, createElement(TabStrip), {
      state: appState({ workspace: { tabs: [first, second], activeTabId: first.id } }),
      actions: stubActions({
        activateTab: async (id) => { activated.push(id); },
        closeTab: async (id) => { closed.push(id); },
      }),
      dispatch: (action) => { dispatched.push(action); },
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
    // The × is pointer chrome ONLY: `role="tab"` treats its children as
    // presentational, so an interactive named button in there was a
    // phantom second stop inside the tablist. It is out of the
    // accessibility tree and the tab order; Delete on the focused tab
    // (advertised via aria-keyshortcuts) is the keyboard close path.
    assert.equal(dom.byLabel('Close First.md').length, 0);
    const closeControls = dom.queryAll('.tab-close');
    assert.deepEqual(closeControls.map((el) => el.getAttribute('aria-hidden')), ['true', 'true']);
    assert.deepEqual(closeControls.map((el) => el.tabIndex), [-1, -1]);
    assert.equal(closeControls[0].getAttribute('title'), 'Close First.md');
    assert.deepEqual(tabs.map((tab) => tab.getAttribute('aria-keyshortcuts')), ['Delete', 'Delete']);
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

    // Delete closes the focused tab — the keyboard replacement for the
    // pointer-only × above.
    await dom.fire(tabs[0], new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    assert.deepEqual(closed, [first.id]);

    // Ctrl/Cmd+Shift+Arrow REORDERS through the same TABS_REORDER action
    // the drag path dispatches — and does not select as it goes.
    activated.length = 0;
    dispatched.length = 0;
    await dom.fire(tabs[0], new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, shiftKey: true, bubbles: true }));
    assert.deepEqual(dispatched, [{ type: 'TABS_REORDER', id: first.id, beforeId: null }]);
    await dom.fire(tabs[1], new KeyboardEvent('keydown', { key: 'ArrowLeft', metaKey: true, shiftKey: true, bubbles: true }));
    assert.deepEqual(dispatched.at(-1), { type: 'TABS_REORDER', id: second.id, beforeId: first.id });
    assert.deepEqual(activated, [], 'reorder keys never activate');
  });
});

test('a keyboard-invoked context menu anchors to the focused row, not the window corner', async () => {
  await withDom(async (dom) => {
    const dispatched: unknown[] = [];
    await mountApp(dom, createElement(FileTree), {
      state: appState({
        workspace: {
          folderPath: '/workspace',
          files: [{ name: 'note.md', format: 'md', heading: '', snippet: '' }],
        },
      }),
      dispatch: (action) => { dispatched.push(action); },
    });
    const row = dom.query('[data-path="note.md"]');
    assert.ok(row);
    row.getBoundingClientRect = () =>
      ({ left: 40, right: 240, top: 70, bottom: 90, width: 200, height: 20, x: 40, y: 70, toJSON: () => ({}) }) as DOMRect;

    // Shift+F10 / the Menu key arrive as a contextmenu event with
    // clientX/Y = 0,0 — the menu must open at the row, not at (0,0).
    await dom.fire(row, new MouseEvent('contextmenu', { bubbles: true, clientX: 0, clientY: 0 }));
    assert.deepEqual(dispatched.at(-1), { type: 'CTX_MENU', menu: { x: 64, y: 90, target: 'note.md', kind: 'file' } });

    // Real pointer coordinates keep winning.
    await dom.fire(row, new MouseEvent('contextmenu', { bubbles: true, clientX: 15, clientY: 25 }));
    assert.deepEqual(dispatched.at(-1), { type: 'CTX_MENU', menu: { x: 15, y: 25, target: 'note.md', kind: 'file' } });
  });
});

test('Move to… opens a labelled folder picker that routes through moveFile', async () => {
  await withDom(async (dom) => {
    const moves: [string, string][] = [];
    await mountApp(dom, createElement(MoveFilePicker), {
      state: appState({
        workspace: {
          folderPath: '/library/workspace',
          folder: 'workspace',
          folders: [{ path: 'Guides' }, { path: 'Guides/Deep' }],
          files: [{ name: 'Guides/inner.md', format: 'md', heading: '', snippet: '' }],
        },
      }),
      actions: stubActions({
        moveFile: async (oldPath, targetDir) => { moves.push([oldPath, targetDir]); return true; },
      }),
    });

    await domAct(async () => { openMoveFilePicker('Guides/inner.md'); });
    await dom.flush();

    // A labelled dialog whose combobox holds focus — the picker is the
    // keyboard path to the move that drag-onto-a-folder performs.
    const dialog = dom.byRole('dialog')[0];
    assert.ok(dialog, 'the picker panel is a dialog');
    assert.equal(dialog.getAttribute('aria-label'), 'Move inner.md to folder');
    const input = dom.byRole('combobox')[0];
    assert.equal(document.activeElement, input, 'focus lands in the picker');
    // Destinations: the folder root plus every inner folder EXCEPT the
    // file's current home (Guides).
    assert.deepEqual(
      dom.byRole('option').map((el) => el.textContent),
      ['workspaceFolder root', 'DeepGuides/Deep'],
    );

    // Escape cancels without moving anything.
    await dom.fire(input, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(dom.byRole('dialog').length, 0);
    assert.deepEqual(moves, []);

    // Reopen; Enter accepts the active destination (the folder root).
    await domAct(async () => { openMoveFilePicker('Guides/inner.md'); });
    await dom.flush();
    await dom.fire(dom.byRole('combobox')[0], new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await dom.flush();
    assert.deepEqual(moves, [['Guides/inner.md', '']]);
    assert.equal(dom.byRole('dialog').length, 0, 'accepting closes the picker');
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
  // The children container renders as the folder row's SIBLING, so the
  // folder claims it explicitly; without aria-owns ARIA sees a flat list.
  const ownedGroupId = folder?.props['aria-owns'];
  assert.ok(ownedGroupId, 'a folder row owns its children group by id');
  const ownedGroup = byRole(renderer.root, 'group').find((node) => node.props.id === ownedGroupId);
  assert.ok(ownedGroup, 'the owned group id resolves to a rendered role="group"');
  // Position within the visible sibling set (folders-first order).
  assert.equal(folder?.props['aria-level'], 1);
  assert.equal(folder?.props['aria-posinset'], 1);
  assert.equal(folder?.props['aria-setsize'], 2);
  assert.equal(selectedFile?.props['aria-posinset'], 2);
  assert.equal(selectedFile?.props['aria-setsize'], 2);

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

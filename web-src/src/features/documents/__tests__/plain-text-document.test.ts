import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorState } from '@codemirror/state';
import { createElement as h } from 'react';
import { appActions, appState, mountApp, withDom } from '@/common/__tests__/renderHarness';
import {
  createPlainTextEditor,
  PlainTextDocument,
} from '@/features/documents/components/PlainTextDocument';
import { initialState, makeTab, reducer } from '@/store/state/state';
import type { AppActions } from '@/store/contexts/AppContext';

test('plain-text editor keeps Markdown, HTML, JSON, and links as literal text', async () => {
  await withDom(async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let changes = 0;
    const source = '# Heading\r\n[link](note.md) <strong>bold</strong> {"value":1}\r\n';
    const session = createPlainTextEditor(host, {
      content: source,
      readOnly: true,
      onUserChange: () => { changes++; },
      onFindInfo: () => undefined,
    });
    assert.equal(
      session.view.state.doc.toString(),
      '# Heading\n[link](note.md) <strong>bold</strong> {"value":1}\n',
    );
    assert.equal(host.querySelector('h1, a, strong'), null, 'source delimiters never become rendered document nodes');
    assert.deepEqual(
      session.find.setQuery('link', { caseSensitive: true, wholeWord: true }),
      { current: 1, total: 1 },
    );
    assert.equal(session.view.state.facet(EditorState.readOnly), true);
    session.setReadOnly(false);
    session.view.dispatch({ changes: { from: 2, to: 9, insert: 'Title' } });
    await Promise.resolve();
    assert.equal(changes, 1);
    session.destroy();
  });
});

test('plain-text tabs expose Find and register save authority only in editable active mode', async () => {
  const tab = makeTab();
  tab.file = { name: 'notes.txt', format: 'txt', content: 'literal source' };
  await withDom(async (dom) => {
    const editors: unknown[] = [];
    const finds: unknown[] = [];
    const actions = appActions({
      registerEditor: ((value: unknown) => { editors.push(value); }) as AppActions['registerEditor'],
      registerFindController: ((value: unknown) => { finds.push(value); }) as AppActions['registerFindController'],
    });
    const state = appState({ workspace: { tabs: [tab], activeTabId: tab.id } });
    const view = (readOnly: boolean, active: boolean) => h(PlainTextDocument, {
      tabId: tab.id,
      content: tab.file!.content,
      readOnly,
      active,
    });
    await mountApp(dom, view(true, true), { state, actions });
    assert.ok(dom.byLabel('Plain text document')[0]);
    assert.notEqual(finds.at(-1), null);
    assert.equal(editors.at(-1), null);
    await mountApp(dom, view(false, true), { state, actions });
    assert.notEqual(editors.at(-1), null);
    await mountApp(dom, view(false, false), { state, actions });
    assert.equal(editors.at(-1), null);
    assert.equal(finds.at(-1), null);
  });
});

test('TXT edit mode is available only for decodable in-folder sources', () => {
  const opened = reducer(initialState, {
    type: 'FILE_OPEN',
    body: { name: 'notes.txt', format: 'txt', content: 'literal' },
  });
  assert.equal(opened.workspace.tabs[0].editMode, false);
  const editing = reducer(opened, { type: 'EDIT_MODE', on: true });
  assert.equal(editing.workspace.tabs[0].editMode, true);

  const failed = reducer(initialState, {
    type: 'FILE_OPEN',
    body: {
      name: 'broken.txt',
      format: 'txt',
      content: '',
      error: { code: 'UNSUPPORTED_ENCODING', message: 'not valid UTF-8' },
    },
  });
  assert.equal(reducer(failed, { type: 'EDIT_MODE', on: true }).workspace.tabs[0].editMode, false);

  const external = reducer(initialState, {
    type: 'FILE_OPEN',
    body: { name: 'notes.txt', format: 'txt', content: 'literal' },
    libraryFolder: '/another-library',
  });
  assert.equal(reducer(external, { type: 'EDIT_MODE', on: true }).workspace.tabs[0].editMode, false);
});

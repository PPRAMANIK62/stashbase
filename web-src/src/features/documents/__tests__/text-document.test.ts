import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorState } from '@codemirror/state';
import { Window } from 'happy-dom';
import {
  createTextEditor,
  fromTextEditorText,
  textMatches,
  toTextEditorText,
} from '@/features/documents/components/TextDocument';

test('plain-text editor preserves source line endings and supports literal Find', () => {
  const source = '\uFEFFAlpha\r\nalpha_beta\r\nalpha\r\n';
  const editorText = toTextEditorText(source);
  assert.equal(editorText, '\uFEFFAlpha\nalpha_beta\nalpha\n');
  assert.equal(fromTextEditorText(editorText.replace('alpha_beta', 'changed'), 'crlf'), '\uFEFFAlpha\r\nchanged\r\nalpha\r\n');
  assert.deepEqual(textMatches(editorText, 'alpha', { caseSensitive: false, wholeWord: true }), [
    { from: 1, to: 6 },
    { from: 18, to: 23 },
  ]);
});

test('plain-text CodeMirror switches between read-only and editable without lossy decoding', async () => {
  const window = new Window({ url: 'http://localhost/' });
  const previous = installDomGlobals(window);
  try {
    const host = window.document.createElement('div');
    window.document.body.appendChild(host);
    let changes = 0;
    const source = 'hello\r\n世界\r\n';
    const session = createTextEditor(host as unknown as HTMLElement, {
      content: source,
      readOnly: true,
      onUserChange: () => { changes += 1; },
      onFindInfo: () => undefined,
    });
    assert.equal(session.view.state.doc.toString(), 'hello\n世界\n');
    assert.equal(session.view.state.facet(EditorState.readOnly), true);
    session.setReadOnly(false);
    assert.equal(session.view.state.facet(EditorState.readOnly), false);
    session.view.dispatch({ changes: { from: 5, insert: '!' } });
    await Promise.resolve();
    assert.equal(changes, 1);
    assert.equal(fromTextEditorText(session.view.state.doc.toString(), 'crlf'), 'hello!\r\n世界\r\n');
    session.replaceFromDisk('external\r\n');
    assert.equal(session.view.state.doc.toString(), 'external\n');
    assert.equal(changes, 1, 'external replacement is not a user edit');
    session.destroy();
    assert.equal(host.querySelector('.cm-editor'), null);
  } finally {
    restoreDomGlobals(previous);
    window.close();
  }
});

type DomGlobals = Record<string, PropertyDescriptor | undefined>;

function installDomGlobals(window: Window): DomGlobals {
  const values: Record<string, unknown> = {
    window,
    document: window.document,
    navigator: window.navigator,
    MutationObserver: window.MutationObserver,
    ResizeObserver: window.ResizeObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    getComputedStyle: window.getComputedStyle.bind(window),
    Element: window.Element,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
  };
  const previous: DomGlobals = {};
  for (const [name, value] of Object.entries(values)) {
    previous[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return previous;
}

function restoreDomGlobals(previous: DomGlobals): void {
  for (const [name, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  }
}

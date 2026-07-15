import assert from 'node:assert/strict';
import test from 'node:test';

import { previewClickHandler } from '../../lib/previewIframe.ts';

test('same-file footnote navigation preserves the iframe fragment state', () => {
  let iframeHash = '';
  const iframeLocation = {
    get hash() { return iframeHash; },
    set hash(value: string) { iframeHash = value.startsWith('#') ? value : `#${value}`; },
  };
  const anchor = {
    getAttribute: (name: string) => name === 'href' ? '#footnote:note' : null,
    ownerDocument: { defaultView: { location: iframeLocation } },
  };
  const event = {
    target: {
      closest: (selector: string) => selector === 'a' ? anchor : null,
    },
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };
  const originalWindow = globalThis.window;
  const messages: unknown[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { origin: 'http://localhost' },
      postMessage: (message: unknown) => messages.push(message),
    },
  });

  try {
    previewClickHandler(event as unknown as Event, 'note.md');
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }

  assert.equal(event.defaultPrevented, true);
  assert.equal(iframeHash, '#footnote:note');
  assert.deepEqual(messages, [
    { type: 'stashbase-nav', path: 'note.md', anchor: 'footnote:note' },
  ]);
});

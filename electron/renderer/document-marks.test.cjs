'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { stampDocumentMarks } = require('../../dist/electron/renderer/document-marks.cjs');

function documentFixture() {
  const attributes = new Set();
  const root = {
    dataset: {},
    toggleAttribute(name, force) {
      if (force) attributes.add(name);
      else attributes.delete(name);
      return attributes.has(name);
    },
  };
  const listeners = new Map();
  return {
    attributes,
    document: {
      documentElement: null,
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
    },
    root,
    ready() {
      this.document.documentElement = root;
      listeners.get('DOMContentLoaded')();
    },
  };
}

function ipcFixture() {
  const listeners = new Map();
  return {
    emit(channel, payload) {
      listeners.get(channel)?.({}, payload);
    },
    on(channel, listener) {
      listeners.set(channel, listener);
    },
  };
}

test('document marks stamp the exact platform once the root exists', () => {
  const ipc = ipcFixture();
  const fixture = documentFixture();
  stampDocumentMarks(ipc, fixture.document, 'darwin');
  assert.equal(fixture.root.dataset.platform, undefined);
  fixture.ready();
  assert.equal(fixture.root.dataset.platform, 'darwin');
});

test('document marks mirror only a well-formed fullscreen push', () => {
  const ipc = ipcFixture();
  const fixture = documentFixture();
  stampDocumentMarks(ipc, fixture.document, 'linux');
  // Before the root exists there is nothing to mark, and nothing throws.
  ipc.emit('window:fullscreen', { fullscreen: true });
  fixture.ready();
  assert.equal(fixture.attributes.has('data-fullscreen'), false);

  ipc.emit('window:fullscreen', { fullscreen: true });
  assert.equal(fixture.attributes.has('data-fullscreen'), true);
  ipc.emit('window:fullscreen', { fullscreen: 'yes' });
  ipc.emit('window:fullscreen', { fullscreen: false, extra: true });
  assert.equal(fixture.attributes.has('data-fullscreen'), true);
  ipc.emit('window:fullscreen', { fullscreen: false });
  assert.equal(fixture.attributes.has('data-fullscreen'), false);
});

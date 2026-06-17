import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedFrameSource, isTrustedPreviewSource } from './lib/previewMessages.ts';

test('preview message trust accepts only the app window and current preview frame', () => {
  const selfWindow = {} as Window;
  const frameWindow = {} as Window;
  const otherWindow = {} as Window;

  assert.equal(isTrustedPreviewSource(selfWindow, selfWindow, frameWindow), true);
  assert.equal(isTrustedPreviewSource(frameWindow, selfWindow, frameWindow), true);
  assert.equal(isTrustedPreviewSource(otherWindow, selfWindow, frameWindow), false);
  assert.equal(isTrustedPreviewSource(null, selfWindow, frameWindow), false);
});

test('frame-scoped preview replies must come from the active iframe', () => {
  const frameWindow = {} as Window;
  const oldFrameWindow = {} as Window;

  assert.equal(isTrustedFrameSource(frameWindow, frameWindow), true);
  assert.equal(isTrustedFrameSource(oldFrameWindow, frameWindow), false);
  assert.equal(isTrustedFrameSource(null, frameWindow), false);
});

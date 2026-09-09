import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureImageAvailableSchema,
  captureMarkHandledRequestSchema,
  captureRefreshWatchResponseSchema,
} from './capture.ts';

test('capture offer payload requires an image, its hash, and a filename', () => {
  assert.equal(
    captureImageAvailableSchema.safeParse({
      dataUrl: 'data:image/png;base64,AAAA',
      filename: 'clipboard-2026-09-09T00-00-00-000Z.png',
      hash: 'abc',
      height: 2,
      mime: 'image/png',
      width: 2,
    }).success,
    true,
  );
  assert.equal(
    captureImageAvailableSchema.safeParse({ dataUrl: 'data:image/png;base64,AAAA' }).success,
    false,
  );
});

test('watch refresh and mark-handled reject loose shapes', () => {
  assert.equal(captureRefreshWatchResponseSchema.safeParse({ enabled: true }).success, true);
  assert.equal(captureRefreshWatchResponseSchema.safeParse(true).success, false);
  assert.equal(captureMarkHandledRequestSchema.safeParse({ hash: '' }).success, false);
});

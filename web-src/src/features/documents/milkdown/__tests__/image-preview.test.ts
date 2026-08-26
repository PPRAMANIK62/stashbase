import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { imagePreviewMessage } from '@/features/documents/milkdown/imagePreview.ts';

test('a rendered image yields the same preview payload the click path posts', () => {
  const image = document.createElement('img') as HTMLImageElement;
  image.src = 'http://localhost/asset/photo.png';
  image.alt = 'A photo';
  assert.deepEqual(imagePreviewMessage(image), {
    type: 'stashbase-preview-image',
    src: 'http://localhost/asset/photo.png',
    alt: 'A photo',
  });
});

test('a missing or source-less image opens nothing', () => {
  assert.equal(imagePreviewMessage(null), null);
  // Upload placeholders and stripped remote refs render an img with no src.
  const placeholder = document.createElement('img') as HTMLImageElement;
  assert.equal(imagePreviewMessage(placeholder), null);
});

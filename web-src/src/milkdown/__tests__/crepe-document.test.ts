import assert from 'node:assert/strict';
import test from 'node:test';

test('image paths stay relative and portable in Markdown', async () => {
  const { relativeAssetPath, portableImageMarkdownPath } = await import('../paths.ts');
  assert.equal(relativeAssetPath('docs/roadmap.md', 'docs/photo.png'), 'photo.png');
  assert.equal(relativeAssetPath('roadmap.md', 'photo.png'), 'photo.png');
  assert.equal(relativeAssetPath('docs/roadmap.md', 'assets/photo.png'), 'assets/photo.png');
  assert.equal(portableImageMarkdownPath('photo one.png'), 'photo%20one.png');
  assert.equal(portableImageMarkdownPath('../assets/photo.png'), '../assets/photo.png');
});

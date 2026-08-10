import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorStatus } from '@milkdown/kit/core';
import { destroyCrepeIfCreated } from '../crepeLifecycle.ts';

test('image paths stay relative and portable in Markdown', async () => {
  const { relativeAssetPath, portableImageMarkdownPath } = await import('../paths.ts');
  assert.equal(relativeAssetPath('docs/roadmap.md', 'docs/photo.png'), 'photo.png');
  assert.equal(relativeAssetPath('roadmap.md', 'photo.png'), 'photo.png');
  assert.equal(relativeAssetPath('docs/roadmap.md', 'assets/photo.png'), 'assets/photo.png');
  assert.equal(portableImageMarkdownPath('photo one.png'), 'photo%20one.png');
  assert.equal(portableImageMarkdownPath('../assets/photo.png'), '../assets/photo.png');
});

test('failed Crepe creation can retry and unmount without destroying the rejected editor', () => {
  const destroyed: string[] = [];
  const failed = {
    editor: { status: EditorStatus.OnCreate },
    destroy: async () => { destroyed.push('failed'); },
  };
  const retry = {
    editor: { status: EditorStatus.Created },
    destroy: async () => { destroyed.push('retry'); },
  };

  assert.equal(destroyCrepeIfCreated(failed), false);
  assert.equal(destroyCrepeIfCreated(retry), true);
  assert.deepEqual(destroyed, ['retry']);
});

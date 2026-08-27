import assert from 'node:assert/strict';
import test from 'node:test';
import { DIRECT_TEXT_EXTENSIONS, NOTE_EXTENSIONS, PLAIN_TEXT_EXTENSIONS, STRUCTURED_DATA_EXTENSIONS, VIEWABLE_FILE_EXTENSIONS } from '../shared/file-formats.ts';
import { detectFormat, isConvertibleSource, isNoteName, matchNoteStem } from './format.ts';
import { hasCompatibleRenameExtension } from './routes/file-mutations.ts';

test('JSON is direct readable text without acquiring note or conversion behavior', () => {
  assert.ok(STRUCTURED_DATA_EXTENSIONS.includes('json'));
  assert.ok(DIRECT_TEXT_EXTENSIONS.includes('json'));
  assert.ok(VIEWABLE_FILE_EXTENSIONS.includes('json'));
  assert.equal((NOTE_EXTENSIONS as readonly string[]).includes('json'), false);
  assert.equal(detectFormat('nested/data.JSON'), 'json');
  assert.equal(detectFormat('C:\\Library\\nested\\data.JsOn'), 'json');
  assert.equal(isNoteName('data.json'), false);
  assert.equal(matchNoteStem('data.json'), null);
  assert.equal(isConvertibleSource('data.json'), false);
});

test('TXT is editable direct text without acquiring note-bundle behavior', () => {
  assert.ok(PLAIN_TEXT_EXTENSIONS.includes('txt'));
  assert.ok(DIRECT_TEXT_EXTENSIONS.includes('txt'));
  assert.ok(VIEWABLE_FILE_EXTENSIONS.includes('txt'));
  assert.equal((NOTE_EXTENSIONS as readonly string[]).includes('txt'), false);
  assert.equal(detectFormat('nested/readme.TXT'), 'text');
  assert.equal(isNoteName('readme.txt'), false);
  assert.equal(matchNoteStem('readme.txt'), null);
  assert.equal(isConvertibleSource('readme.txt'), false);
});

test('JSON keeps its extension without regressing Markdown and HTML cross-format renames', () => {
  assert.equal(hasCompatibleRenameExtension('json', 'json', 'renamed.JSON'), true);
  assert.equal(hasCompatibleRenameExtension('json', 'json', 'renamed.html'), false);
  assert.equal(hasCompatibleRenameExtension('md', 'md', 'renamed.html'), true);
  assert.equal(hasCompatibleRenameExtension('html', 'html', 'renamed.md'), true);
  assert.equal(hasCompatibleRenameExtension('text', 'text', 'renamed.TXT'), true);
  assert.equal(hasCompatibleRenameExtension('text', 'text', 'renamed.md'), false);
});

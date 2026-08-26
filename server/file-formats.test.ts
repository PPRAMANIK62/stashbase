import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIRECT_TEXT_EXTENSIONS,
  NOTE_EXTENSIONS,
  PLAIN_TEXT_EXTENSIONS,
  STRUCTURED_DATA_EXTENSIONS,
  VIEWABLE_FILE_EXTENSIONS,
} from '../shared/file-formats.ts';
import {
  detectFormat,
  isConvertibleSource,
  isNoteName,
  matchNoteStem,
  searchExtensionsForTypes,
} from './format.ts';
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

test('JSON keeps its extension without regressing Markdown and HTML cross-format renames', () => {
  assert.equal(hasCompatibleRenameExtension('json', 'json', 'renamed.JSON'), true);
  assert.equal(hasCompatibleRenameExtension('json', 'json', 'renamed.html'), false);
  assert.equal(hasCompatibleRenameExtension('md', 'md', 'renamed.html'), true);
  assert.equal(hasCompatibleRenameExtension('html', 'html', 'renamed.md'), true);
});

test('TXT is case-insensitive direct text in the notes search category without note-bundle semantics', () => {
  assert.ok(PLAIN_TEXT_EXTENSIONS.includes('txt'));
  assert.ok(DIRECT_TEXT_EXTENSIONS.includes('txt'));
  assert.ok(VIEWABLE_FILE_EXTENSIONS.includes('txt'));
  assert.equal((NOTE_EXTENSIONS as readonly string[]).includes('txt'), false);
  assert.equal(detectFormat('notes/plain.txt'), 'txt');
  assert.equal(detectFormat('notes/MIXED.TxT'), 'txt');
  assert.equal(isNoteName('plain.txt'), false);
  assert.equal(matchNoteStem('plain.txt'), null);
  assert.equal(isConvertibleSource('plain.txt'), false);
  assert.ok(searchExtensionsForTypes(['notes'])?.includes('.txt'));
  assert.equal(searchExtensionsForTypes(['data'])?.includes('.txt'), false);
});

test('TXT keeps its extension across rename compatibility checks', () => {
  assert.equal(hasCompatibleRenameExtension('txt', 'txt', 'renamed.TXT'), true);
  assert.equal(hasCompatibleRenameExtension('txt', 'txt', 'renamed.md'), false);
});

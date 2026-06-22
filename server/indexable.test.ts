import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldIndexFilePath } from './indexable.ts';

test('generated PDF batch resume cache is not indexable', () => {
  assert.equal(shouldIndexFilePath('.book.pdf.md.batches/batch-0001.md'), false);
  assert.equal(shouldIndexFilePath('folder/.book.pdf.md.batches/batch-0001.md'), false);
  assert.equal(shouldIndexFilePath('.book.pdf.md'), true);
});

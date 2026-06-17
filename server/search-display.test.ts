import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { remapKeywordFilesForDisplay, remapSearchHitsForDisplay, type KeywordHitFile } from './search-display.ts';
import type { SearchHit } from './indexer.ts';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

function hit(path: string, line = 1, text = 'needle'): KeywordHitFile {
  return {
    path,
    matches: [{ line, text, ranges: [[0, text.length]] }],
    totalMatches: 1,
  };
}

function semanticHit(fileName: string, content = 'same chunk', chunkIndex = 0): SearchHit {
  return {
    fileName,
    chunkIndex,
    content,
    heading: '',
    startLine: 1,
    endLine: 2,
    score: 1,
  };
}

test('remapKeywordFilesForDisplay maps current derived notes to their source', () => {
  const root = tmpDir('search-display-current');
  fs.writeFileSync(path.join(root, 'paper.pdf'), '%PDF-1.7\n');

  const result = remapKeywordFilesForDisplay([hit('.paper.pdf.md')], root);

  assert.deepEqual(result.files.map((f) => f.path), ['paper.pdf']);
  assert.equal(result.totalMatches, 1);
});

test('remapKeywordFilesForDisplay maps legacy derived notes when a source sibling exists', () => {
  const root = tmpDir('search-display-legacy');
  fs.writeFileSync(path.join(root, 'paper.pdf'), '%PDF-1.7\n');

  const result = remapKeywordFilesForDisplay([hit('.paper.md')], root);

  assert.deepEqual(result.files.map((f) => f.path), ['paper.pdf']);
  assert.equal(result.totalMatches, 1);
});

test('remapKeywordFilesForDisplay drops orphan current derived notes and recounts totals', () => {
  const root = tmpDir('search-display-orphan');

  const result = remapKeywordFilesForDisplay([
    hit('.missing.pdf.md'),
    hit('note.md', 2, 'visible'),
  ], root);

  assert.deepEqual(result.files.map((f) => f.path), ['note.md']);
  assert.equal(result.totalMatches, 1);
});

test('remapKeywordFilesForDisplay merges duplicate current and legacy derived hits', () => {
  const root = tmpDir('search-display-merge');
  fs.writeFileSync(path.join(root, 'paper.pdf'), '%PDF-1.7\n');

  const result = remapKeywordFilesForDisplay([
    hit('.paper.pdf.md'),
    hit('.paper.md'),
  ], root);

  assert.deepEqual(result.files.map((f) => f.path), ['paper.pdf']);
  assert.equal(result.files[0]?.matches.length, 1);
  assert.equal(result.totalMatches, 1);
});

test('remapSearchHitsForDisplay drops orphan derived hits and deduplicates legacy duplicates', () => {
  const root = tmpDir('search-display-semantic');
  fs.writeFileSync(path.join(root, 'paper.pdf'), '%PDF-1.7\n');

  const result = remapSearchHitsForDisplay([
    semanticHit('.paper.pdf.md'),
    semanticHit('.paper.md'),
    semanticHit('.missing.pdf.md', 'orphan chunk'),
    semanticHit('note.md', 'visible chunk'),
  ], root);

  assert.deepEqual(
    result.map((h) => [h.fileName, h.content]),
    [
      ['paper.pdf', 'same chunk'],
      ['note.md', 'visible chunk'],
    ],
  );
});

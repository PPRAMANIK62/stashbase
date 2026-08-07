import assert from 'node:assert/strict';
import test from 'node:test';

import { searchSnippetText } from '../lib/searchSnippet.ts';

test('strips a leading YAML frontmatter block so the snippet starts at content', () => {
  const chunk = [
    '---',
    'generated_by: stashbase-agent',
    'status: prd-v1.6',
    'version: v1.6',
    'updated: 2026-07-27',
    '---',
    '# 学生端 PRD',
    '',
    '正文第一段。',
  ].join('\n');
  assert.equal(searchSnippetText(chunk), '# 学生端 PRD\n\n正文第一段。');
});

test('leaves content without frontmatter untouched', () => {
  assert.equal(searchSnippetText('# Title\n\nBody text.'), '# Title\n\nBody text.');
  assert.equal(searchSnippetText('plain paragraph'), 'plain paragraph');
  assert.equal(searchSnippetText(''), '');
});

test('handles CRLF line endings, BOM, and the `...` closing delimiter', () => {
  assert.equal(searchSnippetText('---\r\ntitle: Doc\r\n---\r\n# Heading\r\nBody'), '# Heading\r\nBody');
  assert.equal(searchSnippetText('﻿---\ntitle: Doc\n---\n# Heading'), '# Heading');
  assert.equal(searchSnippetText('---\ntitle: Doc\n...\n# Heading'), '# Heading');
});

test('accepts comments, blank lines, lists, and nested values inside the block', () => {
  const chunk = [
    '---',
    '# metadata',
    'tags:',
    '  - one',
    '  - two',
    '',
    'title: Doc',
    '---',
    'Body.',
  ].join('\n');
  assert.equal(searchSnippetText(chunk), 'Body.');
});

test('does not eat content between a leading thematic break and a later ---', () => {
  const hr = '---\nOpening prose, no metadata here.\n---\nMore prose.';
  assert.equal(searchSnippetText(hr), hr);
});

test('leaves an unterminated fence alone', () => {
  const open = '---\ntitle: cut off by the chunk boundary';
  assert.equal(searchSnippetText(open), open);
});

test('falls back to the original content when the chunk is only frontmatter', () => {
  const onlyMeta = '---\ntitle: Doc\nstatus: draft\n---\n';
  assert.equal(searchSnippetText(onlyMeta), onlyMeta);
});

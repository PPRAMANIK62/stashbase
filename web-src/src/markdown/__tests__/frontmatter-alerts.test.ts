import assert from 'node:assert/strict';
import test from 'node:test';

import { renderMarkdown, renderMarkdownInline } from '../../markdown.ts';

test('document preview omits valid leading YAML frontmatter', () => {
  const source = [
    '---',
    'title: Release notes',
    'tags:',
    '  - product',
    '---',
    '',
    '# Visible title',
  ].join('\n');
  const document = renderMarkdown(source);
  const inline = renderMarkdownInline(source);

  assert.doesNotMatch(document, /title: Release notes|tags:|product/);
  assert.match(document, /<h1 id="visible-title">Visible title<\/h1>/);
  assert.match(inline, /title: Release notes/);
});

test('document preview omits valid CR-only YAML frontmatter', () => {
  const source = '---\rtitle: Release notes\r---\r# Visible title';
  const document = renderMarkdown(source);

  assert.doesNotMatch(document, /title: Release notes/);
  assert.match(document, /<h1 id="visible-title">Visible title<\/h1>/);
});

test('malformed or unterminated frontmatter remains visible source', () => {
  for (const source of [
    '---\ntitle: [broken\n---\n\n# Visible title',
    '---\ntitle: Unclosed\n\n# Visible title',
  ]) {
    const document = renderMarkdown(source);

    assert.match(document, /title:/);
    assert.match(document, /Visible title/);
  }
});

test('document preview renders GitHub alert variants with accessible labels', () => {
  const document = renderMarkdown([
    '> [!NOTE]',
    '> Helpful context.',
    '',
    '> [!TIP]',
    '> Practical guidance.',
    '',
    '> [!IMPORTANT]',
    '> Critical details.',
    '',
    '> [!WARNING]',
    '> Proceed carefully.',
    '',
    '> [!CAUTION]',
    '> Destructive action ahead.',
  ].join('\n'));

  for (const variant of ['note', 'tip', 'important', 'warning', 'caution']) {
    assert.match(document, new RegExp(`<div[^>]*class="markdown-alert markdown-alert-${variant}"[^>]*>`));
    assert.match(document, new RegExp(`class="markdown-alert-title"[^>]*>[\\s\\S]*?${variant[0].toUpperCase()}${variant.slice(1)}<\\/p>`));
  }
  assert.match(document, /aria-label="Note"/);
  assert.match(document, /<svg[^>]*viewbox="0 0 16 16"[^>]*aria-hidden="true">/);
  assert.match(document, /Helpful context\./);
});

test('alert output stays sanitized and Agent messages remain isolated', () => {
  const source = '> [!WARNING]\n> <script>alert("unsafe")</script>\n> [unsafe](javascript:alert("unsafe"))';
  const document = renderMarkdown(source);
  const inline = renderMarkdownInline(source);

  assert.match(document, /markdown-alert-warning/);
  assert.doesNotMatch(document, /<script|javascript:/i);
  assert.doesNotMatch(inline, /markdown-alert/);
  assert.match(inline, /\[!WARNING\]/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { renderMarkdown, renderMarkdownInline } from '../../markdown.ts';

test('document soft breaks collapse while inline soft breaks remain visible', () => {
  const document = renderMarkdown('first line\nsecond line');
  const inline = renderMarkdownInline('first line\nsecond line');

  assert.match(document, /<p>first line\nsecond line<\/p>/);
  assert.doesNotMatch(document, /<br\s*\/?\s*>/);
  assert.match(inline, /first line<br>second line/);
});

test('document hard-break syntax creates line breaks', () => {
  const document = renderMarkdown('spaces  \nbackslash\\\nnext');

  assert.match(document, /<p>spaces<br\s*\/>backslash<br\s*\/>next<\/p>/);
});

test('document renderer preserves the GFM block baseline', () => {
  const document = renderMarkdown([
    '- item',
    '- [x] done',
    '',
    '| Left | Right |',
    '| --- | --- |',
    '| one | two |',
  ].join('\n'));

  assert.match(document, /<ul>[\s\S]*<li>item<\/li>/);
  const checkbox = document.match(/<input\b[^>]*>/)?.[0] ?? '';
  assert.match(checkbox, /\btype="checkbox"/);
  assert.match(checkbox, /\bchecked(?:="")?/);
  assert.match(checkbox, /\bdisabled(?:="")?/);
  assert.match(document, /\/?> done/);
  assert.match(document, /<table>[\s\S]*<th>Left<\/th>[\s\S]*<td>two<\/td>/);
});

test('document renderer preserves links, images, escapes, entities, and code', () => {
  const document = renderMarkdown([
    '[link](https://example.com) ![alt](image.png) \\*literal\\* &amp; `inline`',
    '',
    '```ts',
    'const answer = 42;',
    '```',
    '',
    '    indented code',
  ].join('\n'));

  assert.match(document, /<a href="https:\/\/example\.com">link<\/a>/);
  assert.match(document, /<img src="image\.png" alt="alt"\s*\/>/);
  assert.match(document, /\*literal\* &amp; <code>inline<\/code>/);
  assert.match(document, /<pre><code class="language-ts">const answer = 42;\n<\/code><\/pre>/);
  assert.match(document, /<pre><code>indented code\n<\/code><\/pre>/);
});

test('document headings have deterministic duplicate-safe GitHub anchors', () => {
  const document = renderMarkdown('# Café 世界\n\n# Café 世界\n\n# Release notes!\n\n# Release notes!');

  assert.match(document, /<h1 id="café-世界">Café 世界<\/h1>/);
  assert.match(document, /<h1 id="café-世界-1">Café 世界<\/h1>/);
  assert.match(document, /<h1 id="release-notes">Release notes!<\/h1>/);
  assert.match(document, /<h1 id="release-notes-1">Release notes!<\/h1>/);
});

test('document heading anchors avoid collisions with generated suffixes', () => {
  const document = renderMarkdown('# Foo\n\n# Foo-1\n\n# Foo');

  assert.match(document, /<h1 id="foo">Foo<\/h1>/);
  assert.match(document, /<h1 id="foo-1">Foo-1<\/h1>/);
  assert.match(document, /<h1 id="foo-2">Foo<\/h1>/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { renderMarkdown, renderMarkdownInline } from '../../markdown.ts';

test('document renderer links named footnotes to one semantic footnote section', () => {
  const document = renderMarkdown([
    'A documented claim.[^source]',
    '',
    '[^source]: **Primary** source.',
  ].join('\n'));

  assert.match(
    document,
    /<sup class="footnote-ref"><a href="#footnote:source" id="footnote-ref:source" aria-label="Footnote 1">1<\/a><\/sup>/,
  );
  assert.match(document, /<section class="footnotes" aria-label="Footnotes">/);
  assert.match(document, /<li id="footnote:source"><p><strong>Primary<\/strong> source\./);
  assert.match(
    document,
    /<a href="#footnote-ref:source" class="footnote-backref" aria-label="Back to reference 1 for footnote 1">↩<\/a>/,
  );
  assert.doesNotMatch(document, /\[\^source\]/);
});

test('document footnotes support indented continuation blocks', () => {
  const document = renderMarkdown([
    'Claim.[^details]',
    '',
    '[^details]: First paragraph.',
    '',
    '    Second paragraph with `code`.',
  ].join('\n'));

  assert.match(
    document,
    /<li id="footnote:details"><p>First paragraph.<\/p>\s*<p>Second paragraph with <code>code<\/code>\./,
  );
  assert.doesNotMatch(document, /<pre><code>Second paragraph/);
});

test('extracting a footnote definition preserves surrounding block boundaries', () => {
  const document = renderMarkdown([
    'Before',
    '[^note]: Detail.',
    'After[^note]',
  ].join('\n'));

  assert.match(document, /<p>Before<\/p>\s*<p>After/);
});

test('document footnotes parse CRLF and CR source consistently', () => {
  for (const newline of ['\r\n', '\r']) {
    const document = renderMarkdown(`Claim.[^note]${newline}${newline}[^note]: Detail.${newline}`);

    assert.match(document, /href="#footnote:note" id="footnote-ref:note"/);
    assert.match(document, /<li id="footnote:note"><p>Detail\./);
  }
});

test('nested footnote references remain literal instead of creating dangling links', () => {
  const document = renderMarkdown([
    'Claim.[^outer]',
    '',
    '[^outer]: Keep nested[^inner] literal.',
    '[^inner]: Inner detail.',
  ].join('\n'));

  assert.match(document, /<li id="footnote:outer"><p>Keep nested\[\^inner\] literal\./);
  assert.doesNotMatch(document, /href="#footnote:inner"/);
  assert.doesNotMatch(document, /<li id="footnote:inner">/);
});

test('repeated footnote references have unique targets and one footnote body', () => {
  const document = renderMarkdown([
    'First[^same] and second[^same].',
    '',
    '[^same]: Shared note.',
  ].join('\n'));

  assert.match(document, /id="footnote-ref:same" aria-label="Footnote 1"/);
  assert.match(document, /id="footnote-ref:same-2" aria-label="Footnote 1, reference 2"/);
  assert.equal(document.match(/<li id="footnote:same">/g)?.length, 1);
  assert.match(document, /href="#footnote-ref:same"[^>]*>↩<\/a>/);
  assert.match(document, /href="#footnote-ref:same-2"[^>]*>↩<\/a>/);
});

test('block footnote bodies still end with a backlink', () => {
  const document = renderMarkdown([
    'Claim.[^steps]',
    '',
    '[^steps]:',
    '    - First',
    '    - Second',
  ].join('\n'));

  assert.match(document, /<li id="footnote:steps"><ul>[\s\S]*<li>Second<\/li>[\s\S]*<a href="#footnote-ref:steps" class="footnote-backref"/);
});

test('footnote IDs stay stable when normalized labels collide', () => {
  const document = renderMarkdown([
    'One[^A!] and two[^A?].',
    '',
    '[^A!]: First.',
    '[^A?]: Second.',
  ].join('\n'));

  assert.match(document, /href="#footnote:a" id="footnote-ref:a"/);
  assert.match(document, /href="#footnote:a-1" id="footnote-ref:a-1"/);
  assert.match(document, /<li id="footnote:a">/);
  assert.match(document, /<li id="footnote:a-1">/);
});

test('malformed, undefined, code, and fenced footnotes remain literal', () => {
  const document = renderMarkdown([
    'Undefined[^missing], malformed [^], and `code[^code]`.',
    '',
    '```md',
    'fenced[^fence]',
    '[^fence]: Not a definition.',
    '```',
  ].join('\n'));

  assert.match(document, /Undefined\[\^missing\], malformed \[\^\], and <code>code\[\^code\]<\/code>/);
  assert.match(document, /fenced\[\^fence\]/);
  assert.match(document, /\[\^fence\]: Not a definition\./);
  assert.doesNotMatch(document, /class="footnotes"/);
});

test('escaped references and definitions inside raw HTML remain literal', () => {
  const document = renderMarkdown([
    'Escaped \\[^note].',
    '',
    '<div>',
    '[^note]: Inside raw HTML.',
    '</div>',
    '',
    'Still undefined[^note].',
  ].join('\n'));

  assert.match(document, /Escaped \[\^note\]\./);
  assert.match(document, /<div>\s*\[\^note\]: Inside raw HTML\.\s*<\/div>/);
  assert.match(document, /Still undefined\[\^note\]\./);
  assert.doesNotMatch(document, /class="footnotes"/);
});

test('non-closing fence lines do not expose footnote definitions', () => {
  const document = renderMarkdown([
    '````md',
    '```not-a-close',
    '[^note]: Still fenced.',
    '````',
    '',
    'Undefined[^note].',
  ].join('\n'));

  assert.match(document, /\[\^note\]: Still fenced\./);
  assert.match(document, /Undefined\[\^note\]\./);
  assert.doesNotMatch(document, /class="footnotes"/);
});

test('invalid backtick fence openers do not hide footnote definitions', () => {
  const document = renderMarkdown([
    '```bad`',
    '',
    '[^note]: Detail.',
    '',
    'Text[^note].',
  ].join('\n'));

  assert.match(document, /<sup class="footnote-ref"><a href="#footnote:note"/);
  assert.match(document, /<li id="footnote:note"><p>Detail\./);
});

test('definitions inside generic raw HTML blocks remain literal', () => {
  const document = renderMarkdown([
    '<span>',
    '[^note]: Inside raw HTML.',
    '</span>',
    '',
    'Undefined[^note].',
  ].join('\n'));

  assert.match(document, /<span>\s*\[\^note\]: Inside raw HTML\.\s*<\/span>/);
  assert.match(document, /Undefined\[\^note\]\./);
  assert.doesNotMatch(document, /class="footnotes"/);
});

test('footnote entry IDs cannot collide with generated heading IDs', () => {
  const document = renderMarkdown([
    '# Footnote note',
    '',
    'Text[^note].',
    '',
    '[^note]: Detail.',
  ].join('\n'));

  assert.match(document, /<h1 id="footnote-note">Footnote note<\/h1>/);
  assert.match(document, /href="#footnote:note"/);
  assert.match(document, /<li id="footnote:note">/);
});

test('document sanitization permits only generated footnote classes', () => {
  const document = renderMarkdown([
    '<a class="unrelated" href="https://example.com">Link</a>',
    '<section class="unrelated">Section</section>',
    '<sup class="unrelated">Sup</sup>',
    '',
    'Text[^note].',
    '',
    '[^note]: Detail.',
  ].join('\n'));

  assert.doesNotMatch(document, /class="unrelated"/);
  assert.match(document, /<sup class="footnote-ref">/);
  assert.match(document, /<section class="footnotes"/);
  assert.match(document, /class="footnote-backref"/);
});

test('footnote parsing is isolated from inline rendering', () => {
  const inline = renderMarkdownInline('Inline[^note]\n\n[^note]: Keep literal.');

  assert.match(inline, /Inline\[\^note\]/);
  assert.match(inline, /\[\^note\]: Keep literal\./);
  assert.doesNotMatch(inline, /class="footnote/);
});

test('footnote references and backlinks have preview-local readable focus styles', () => {
  const document = renderMarkdown('Text[^note].\n\n[^note]: Detail.');

  assert.match(document, /\.footnotes \{/);
  assert.match(document, /\.footnote-ref a:focus-visible,\s*\.footnote-backref:focus-visible \{/);
  assert.match(document, /outline: 2px solid #0e7490/);
});

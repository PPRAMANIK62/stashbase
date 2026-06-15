import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractEmbeddedResources } from './resources.ts';

// 1x1 transparent PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('markdown: extracts a data: image into <stem>_files/ and rewrites the ref', () => {
  const md = `# Note\n\n![pic](data:image/png;base64,${PNG_B64})\n`;
  const { content, assets } = extractEmbeddedResources('research/note.md', md);
  assert.equal(assets.length, 1);
  assert.match(assets[0].path, /^research\/note_files\/[0-9a-f]{16}\.png$/);
  assert.ok(Buffer.compare(assets[0].bytes, Buffer.from(PNG_B64, 'base64')) === 0);
  assert.ok(!content.includes('data:image'));
  // The rewritten ref is relative to the note (bundle name only).
  assert.match(content, /!\[pic\]\(note_files\/[0-9a-f]{16}\.png\)/);
});

test('html: extracts a data: src attribute', () => {
  const html = `<p><img src="data:image/png;base64,${PNG_B64}" alt="x"></p>`;
  const { content, assets } = extractEmbeddedResources('s/page.html', html);
  assert.equal(assets.length, 1);
  assert.match(content, /src="page_files\/[0-9a-f]{16}\.png"/);
  assert.ok(!content.includes('data:image'));
});

test('identical payloads dedupe to a single asset', () => {
  const md =
    `![a](data:image/png;base64,${PNG_B64})\n` +
    `![b](data:image/png;base64,${PNG_B64})\n`;
  const { content, assets } = extractEmbeddedResources('s/n.md', md);
  assert.equal(assets.length, 1);
  // Both refs point at the same extracted file.
  const refs = [...content.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(refs[0], refs[1]);
});

test('remote http(s) refs are left untouched', () => {
  const html = `<img src="https://example.com/a.png"><a href="http://x.com">l</a>`;
  const { content, assets } = extractEmbeddedResources('s/p.html', html);
  assert.equal(assets.length, 0);
  assert.equal(content, html);
});

test('existing relative refs are left untouched', () => {
  const html = `<img src="figure.png">`;
  const { content, assets } = extractEmbeddedResources('s/p.html', html);
  assert.equal(assets.length, 0);
  assert.equal(content, html);
});

test('non-note formats are a no-op', () => {
  const txt = `data:image/png;base64,${PNG_B64}`;
  const { content, assets } = extractEmbeddedResources('s/notes.txt', txt);
  assert.equal(assets.length, 0);
  assert.equal(content, txt);
});

test('svg utf8 data URI (non-base64) decodes and gets .svg ext', () => {
  const svg = '<svg xmlns=%22http://www.w3.org/2000/svg%22></svg>';
  const html = `<img src="data:image/svg+xml,${svg}">`;
  const { assets } = extractEmbeddedResources('s/p.html', html);
  assert.equal(assets.length, 1);
  assert.match(assets[0].path, /\.svg$/);
  assert.ok(assets[0].bytes.toString('utf8').includes('<svg'));
});

test('kbRoot-relative note path: asset path keeps the same convention', () => {
  const md = `![p](data:image/png;base64,${PNG_B64})`;
  const { assets } = extractEmbeddedResources('research/sub/note.md', md);
  assert.match(assets[0].path, /^research\/sub\/note_files\//);
});

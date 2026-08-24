import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeHtml } from './html.ts';

// The preview iframe renders a user's own document, so the app stylesheet
// never reaches it. What the server injects is the only chrome the frame
// gets, and these are the properties of that injection that matter.

test('previewed HTML carries a neutral scrollbar rule', () => {
  const { preparedHtml } = analyzeHtml('<html><head><title>t</title></head><body><p>x</p></body></html>');
  assert.match(preparedHtml, /scrollbar-width:thin/);
  // Transparent track, not a themed pair: the page's own background shows
  // through, so one rule reads on light and dark documents alike.
  assert.match(preparedHtml, /scrollbar-color:rgba\(140,140,140,\.4\) transparent/);
});

test('the scrollbar rule precedes the page, so a page that styles its own wins', () => {
  const { preparedHtml } = analyzeHtml(
    '<html><head><style>html{scrollbar-color:red blue}</style></head><body><p>x</p></body></html>',
  );
  // Source order is the whole mechanism — same specificity, no
  // `!important`, injected first. A document that said nothing gets a
  // sane default; one that expressed an opinion keeps it.
  assert.ok(preparedHtml.indexOf('scrollbar-width:thin') < preparedHtml.indexOf('red blue'));
});

test('a document with no head still gets the rule ahead of its content', () => {
  const { preparedHtml } = analyzeHtml('<h1>Fragment</h1><p>body only</p>');
  assert.ok(preparedHtml.startsWith('<style>'));
  assert.ok(preparedHtml.indexOf('scrollbar-width:thin') < preparedHtml.indexOf('Fragment'));
});

test('injected chrome never reaches the indexed plaintext', () => {
  // `plaintext` feeds MFS chunking and keyword search. Viewer chrome in
  // the index would be a search hit on every HTML file in the library.
  const { plaintext } = analyzeHtml('<html><head><title>t</title></head><body><h1>Hi</h1><p>x</p></body></html>');
  assert.doesNotMatch(plaintext, /scrollbar/);
  assert.equal(plaintext, 't\n\n# Hi\n\nx');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentOutline } from '../components/DocumentOutline';

test('outline entries are keyboard buttons with active and full-label accessibility state', () => {
  const markup = renderToStaticMarkup(createElement(DocumentOutline, {
    headings: [
      { id: 'overview', level: 1, text: 'Overview' },
      { id: 'section', level: 3, text: '' },
    ],
    activeId: 'overview',
    onSelect: () => {},
  }));
  assert.match(markup, /aria-label="Document outline"/);
  assert.match(markup, /<button[^>]*aria-label="Heading level 1: Overview"[^>]*aria-current="location"/);
  assert.match(markup, /<button[^>]*aria-label="Heading level 3: Untitled section 1"/);
  assert.doesNotMatch(markup, />H1</);
  assert.match(markup, /class="tree-row outline-tree-row active" style="padding-left:4px"/);
});

test('outline has a quiet empty state', () => {
  const markup = renderToStaticMarkup(createElement(DocumentOutline, {
    headings: [], activeId: null, onSelect: () => {},
  }));
  assert.match(markup, /No headings/);
});

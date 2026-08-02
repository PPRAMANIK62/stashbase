import assert from 'node:assert/strict';
import test from 'node:test';
import { activeHeadingId, extractDocumentHeadings, outlineDepth, outlineHasChildren, outlineScrollTop, visibleOutlineHeadings } from '../milkdown/headings';

test('outline headings keep hierarchy and stable duplicate Unicode targets', () => {
  const nodes = [
    { type: { name: 'heading' }, attrs: { level: 1 }, textContent: 'Résumé' },
    { type: { name: 'paragraph' }, attrs: {}, textContent: '# not a heading' },
    { type: { name: 'heading' }, attrs: { level: 3 }, textContent: 'Résumé' },
    { type: { name: 'heading' }, attrs: { level: 6 }, textContent: '日本語!' },
  ];
  const doc = { descendants: (visit: (node: typeof nodes[number]) => void) => nodes.forEach(visit) };
  assert.deepEqual(extractDocumentHeadings(doc), [
    { id: 'resume', level: 1, text: 'Résumé' },
    { id: 'resume-1', level: 3, text: 'Résumé' },
    { id: '日本語', level: 6, text: '日本語!' },
  ]);
});

test('live heading changes, active tracking, and large documents remain predictable', () => {
  const documentWith = (text: string) => ({ descendants: (visit: (node: { type: { name: string }; attrs: { level: number }; textContent: string }) => void) => visit({ type: { name: 'heading' }, attrs: { level: 2 }, textContent: text }) });
  assert.deepEqual(extractDocumentHeadings(documentWith('Before')), [{ id: 'before', level: 2, text: 'Before' }]);
  const updated = extractDocumentHeadings(documentWith('After'));
  assert.deepEqual(updated, [{ id: 'after', level: 2, text: 'After' }]);
  assert.equal(activeHeadingId(updated, [{ id: 'after', top: 20 }], 30), 'after');
  assert.equal(outlineScrollTop(100, 300, 180), 380);
  assert.equal(outlineScrollTop(100, 0, 20), 0);
  const large = { descendants: (visit: (node: { type: { name: string }; attrs: { level: number }; textContent: string }) => void) => { for (let i = 0; i < 2000; i++) visit({ type: { name: 'heading' }, attrs: { level: 1 }, textContent: `Section ${i}` }); } };
  assert.equal(extractDocumentHeadings(large).length, 2000);
});

test('outline collapse hides only a heading’s descendants and supports skipped levels', () => {
  const headings = [
    { id: 'one', level: 1, text: 'One' },
    { id: 'two', level: 2, text: 'Two' },
    { id: 'three', level: 3, text: 'Three' },
    { id: 'four', level: 2, text: 'Four' },
    { id: 'five', level: 1, text: 'Five' },
  ];
  assert.equal(outlineHasChildren(headings, 0), true);
  assert.equal(outlineHasChildren(headings, 3), false);
  assert.deepEqual(headings.map((_heading, index) => outlineDepth(headings, index)), [0, 1, 2, 1, 0]);
  assert.deepEqual(visibleOutlineHeadings(headings, new Set(['two'])).map(({ id }) => id), ['one', 'two', 'four', 'five']);
  assert.deepEqual(visibleOutlineHeadings(headings, new Set(['one'])).map(({ id }) => id), ['one', 'five']);
});

test('outline depth follows structure when Markdown skips heading levels', () => {
  const headings = [
    { id: 'parent', level: 2, text: 'Parent' },
    { id: 'child', level: 4, text: 'Child' },
    { id: 'sibling', level: 3, text: 'Sibling' },
  ];
  assert.deepEqual(headings.map((_heading, index) => outlineDepth(headings, index)), [0, 1, 1]);
});

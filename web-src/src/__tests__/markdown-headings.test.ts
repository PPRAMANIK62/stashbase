import assert from 'node:assert/strict';
import test from 'node:test';
import { activeHeadingId, extractDocumentHeadings, outlineModeForWidth } from '../milkdown/headings';

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

test('live heading changes, active tracking, responsive modes, and large documents remain predictable', () => {
  const documentWith = (text: string) => ({ descendants: (visit: (node: { type: { name: string }; attrs: { level: number }; textContent: string }) => void) => visit({ type: { name: 'heading' }, attrs: { level: 2 }, textContent: text }) });
  assert.deepEqual(extractDocumentHeadings(documentWith('Before')), [{ id: 'before', level: 2, text: 'Before' }]);
  const updated = extractDocumentHeadings(documentWith('After'));
  assert.deepEqual(updated, [{ id: 'after', level: 2, text: 'After' }]);
  assert.equal(activeHeadingId(updated, [{ id: 'after', top: 20 }], 30), 'after');
  assert.equal(outlineModeForWidth(1080), 'docked');
  assert.equal(outlineModeForWidth(1079), 'overlay');
  const large = { descendants: (visit: (node: { type: { name: string }; attrs: { level: number }; textContent: string }) => void) => { for (let i = 0; i < 2000; i++) visit({ type: { name: 'heading' }, attrs: { level: 1 }, textContent: `Section ${i}` }); } };
  assert.equal(extractDocumentHeadings(large).length, 2000);
});

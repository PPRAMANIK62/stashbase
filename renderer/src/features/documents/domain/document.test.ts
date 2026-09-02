import { describe, expect, it } from 'vite-plus/test';

import {
  createDocumentState,
  documentAccess,
  documentTextFormat,
  disposeDocumentState,
  sameSource,
  sourceIdentity,
  sourceName,
} from './document';

describe('document identity', () => {
  it('keeps the owning folder in source identity', () => {
    const notes = { folderPath: '/library/notes', path: 'drafts/plan.md' };
    const archive = { folderPath: '/library/archive', path: 'drafts/plan.md' };

    expect(sameSource(notes, { ...notes })).toBe(true);
    expect(sameSource(notes, archive)).toBe(false);
    expect(sourceIdentity(notes)).not.toBe(sourceIdentity(archive));
    expect(sourceName(notes)).toBe('plan.md');
  });

  it('disposes document state without changing its source scope', () => {
    const scope = {
      generation: 2,
      id: 'tab-1',
      source: { folderPath: '/library/notes', path: 'plan.md' },
    };
    const disposed = disposeDocumentState(createDocumentState(scope, 'editable'));

    expect(disposed).toEqual({ access: 'editable', lifecycle: 'disposed', scope });
    expect(disposeDocumentState(disposed)).toBe(disposed);
  });

  it('classifies only Markdown and TXT source names for direct loading', () => {
    expect(documentTextFormat('notes/plan.md')).toBe('md');
    expect(documentTextFormat('notes/plan.MARKDOWN')).toBe('md');
    expect(documentTextFormat('notes/literal.TXT')).toBe('txt');
    expect(documentTextFormat('notes/data.json')).toBeNull();
    expect(documentTextFormat('notes/no-extension')).toBeNull();
  });

  it('grants edit capability only to sources in the active folder scope', () => {
    expect(
      documentAccess({ folderPath: '/library/notes', path: 'plan.md' }, '/library/notes'),
    ).toBe('editable');
    expect(
      documentAccess({ folderPath: '/library/archive', path: 'plan.md' }, '/library/notes'),
    ).toBe('read-only');
  });
});

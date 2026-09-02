import { describe, expect, it } from 'vite-plus/test';

import {
  acceptDocumentSave,
  beginDocumentSave,
  changeDocumentText,
  createDocumentState,
  documentAccess,
  documentEditorText,
  documentTextFormat,
  disposeDocumentState,
  reconcileDocumentSource,
  rejectDocumentSave,
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

    expect(disposed).toEqual({ access: 'editable', editor: null, lifecycle: 'disposed', scope });
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

  it('normalizes editor line endings while retaining a versioned baseline', () => {
    const scope = {
      generation: 1,
      id: 'tab-1',
      source: { folderPath: '/library/notes', path: 'notes.txt' },
    };
    const loaded = reconcileDocumentSource(createDocumentState(scope, 'editable'), {
      content: '\uFEFFone\r\ntwo\r\n',
      format: 'txt',
      version: 'v1',
    });

    expect(documentEditorText('one\rtwo\r\n')).toBe('one\ntwo\n');
    expect(loaded.editor).toMatchObject({
      baseline: '\uFEFFone\ntwo\n',
      dirty: false,
      value: '\uFEFFone\ntwo\n',
      version: 'v1',
    });
  });

  it('makes the live draft dirty synchronously and preserves newer input after save', () => {
    const scope = {
      generation: 1,
      id: 'tab-1',
      source: { folderPath: '/library/notes', path: 'plan.md' },
    };
    let state = reconcileDocumentSource(createDocumentState(scope, 'editable'), {
      content: 'one\r\n',
      format: 'md',
      version: 'v1',
    });
    state = changeDocumentText(state, 'first edit\n');
    const capturedRevision = state.editor?.revision ?? -1;
    state = beginDocumentSave(state);
    state = changeDocumentText(state, 'newer edit\n');
    state = acceptDocumentSave(state, capturedRevision, {
      content: 'first edit\r\n',
      format: 'md',
      version: 'v2',
    });

    expect(state.editor).toMatchObject({
      baseline: 'first edit\n',
      dirty: true,
      savePhase: 'unsaved',
      value: 'newer edit\n',
      version: 'v2',
    });
  });

  it('keeps a conflicted draft recoverable', () => {
    const scope = {
      generation: 1,
      id: 'tab-1',
      source: { folderPath: '/library/notes', path: 'plan.md' },
    };
    let state = reconcileDocumentSource(createDocumentState(scope, 'editable'), {
      content: 'before',
      format: 'md',
      version: 'v1',
    });
    state = changeDocumentText(state, 'draft');
    state = rejectDocumentSave(state, {
      conflictVersion: 'v2',
      message: 'changed on disk',
      phase: 'conflict',
    });

    expect(state.editor).toMatchObject({
      conflictVersion: 'v2',
      dirty: true,
      saveMessage: 'changed on disk',
      savePhase: 'conflict',
      value: 'draft',
      version: 'v1',
    });
  });
});

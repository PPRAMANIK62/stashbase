import { describe, expect, it } from 'vite-plus/test';

import {
  createDocumentState,
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
    const disposed = disposeDocumentState(createDocumentState(scope));

    expect(disposed).toEqual({ lifecycle: 'disposed', scope });
    expect(disposeDocumentState(disposed)).toBe(disposed);
  });
});

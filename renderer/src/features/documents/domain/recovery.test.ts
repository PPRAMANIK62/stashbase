import { describe, expect, it } from 'vite-plus/test';

import { textSource } from '@/test/fakes/documents';

import {
  changeDocumentText,
  createDocumentState,
  enterDocumentConflict,
  isDocumentDirty,
  reconcileDocumentSource,
} from './document';
import {
  recoveryCandidateKey,
  recoveryCandidateNote,
  recoveryStaleness,
  restoreDocumentDraft,
  sortRecoveryCandidates,
  toRecoveryCandidate,
} from './recovery';

const source = { folderPath: '/library/notes', path: 'drafts/plan.md' };

describe('recovery candidates', () => {
  it('derives staleness from the version pair', () => {
    expect(recoveryStaleness('v1', 'v1')).toBe('current');
    expect(recoveryStaleness('v1', 'v2')).toBe('changed');
    expect(recoveryStaleness('v1', null)).toBe('missing');
  });

  it('builds a candidate from a listed summary and keys it by source', () => {
    const candidate = toRecoveryCandidate({
      currentVersion: 'v2',
      expectedVersion: 'v1',
      savedAt: '2026-09-10T08:00:00.000Z',
      source,
    });
    expect(candidate).toEqual({
      expectedVersion: 'v1',
      savedAt: '2026-09-10T08:00:00.000Z',
      source,
      staleness: 'changed',
    });
    expect(recoveryCandidateKey(candidate)).toBe(recoveryCandidateKey({ source: { ...source } }));
  });

  it('says only what needs saying before a restore', () => {
    const at = (staleness: 'changed' | 'current' | 'missing') => ({
      expectedVersion: 'v1',
      savedAt: '2026-09-10T08:00:00.000Z',
      source,
      staleness,
    });
    expect(recoveryCandidateNote(at('current'))).toBeNull();
    expect(recoveryCandidateNote(at('changed'))).toBe('The file changed since this draft.');
    expect(recoveryCandidateNote(at('missing'))).toBe('The file no longer exists.');
  });

  it('orders candidates newest first without mutating the input', () => {
    const older = toRecoveryCandidate({
      currentVersion: 'v1',
      expectedVersion: 'v1',
      savedAt: '2026-09-09T08:00:00.000Z',
      source: { folderPath: '/library/notes', path: 'a.md' },
    });
    const newer = toRecoveryCandidate({
      currentVersion: 'v1',
      expectedVersion: 'v1',
      savedAt: '2026-09-10T08:00:00.000Z',
      source: { folderPath: '/library/notes', path: 'b.md' },
    });
    const input = [older, newer];
    expect(sortRecoveryCandidates(input)).toEqual([newer, older]);
    expect(input).toEqual([older, newer]);
  });
});

describe('restoring a draft into its document', () => {
  it('restores a recovered draft as unsaved text over the loaded source', () => {
    const scope = {
      generation: 1,
      id: 'tab-1',
      source: { folderPath: '/library/notes', path: 'plan.md' },
    };
    const loaded = reconcileDocumentSource(
      createDocumentState(scope, 'editable'),
      textSource({ content: 'disk', version: 'v2' }),
    );

    const restored = restoreDocumentDraft(loaded, {
      content: 'draft\r\ntext',
      expectedVersion: 'v1',
    });
    expect(restored.editor).toMatchObject({
      baseline: 'disk',
      restores: 1,
      revision: 1,
      save: { kind: 'dirty' },
      value: 'draft\ntext',
      version: 'v1',
    });
    expect(restored.editor && isDocumentDirty(restored.editor)).toBe(true);
    expect(reconcileDocumentSource(restored, textSource({ content: 'disk', version: 'v2' }))).toBe(
      restored,
    );

    expect(restoreDocumentDraft(loaded, { content: 'disk', expectedVersion: 'v1' })).toBe(loaded);
    expect(
      restoreDocumentDraft(createDocumentState(scope, 'editable'), {
        content: 'draft',
        expectedVersion: 'v1',
      }).editor,
    ).toBeNull();
    const conflicted = enterDocumentConflict(
      changeDocumentText(loaded, 'typed'),
      textSource({ content: 'newer', version: 'v3' }),
    );
    expect(restoreDocumentDraft(conflicted, { content: 'draft', expectedVersion: 'v1' })).toBe(
      conflicted,
    );
  });
});

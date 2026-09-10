import { describe, expect, it } from 'vite-plus/test';

import {
  documentFailure,
  DOCUMENT_ASSET_MESSAGES,
  DOCUMENT_OVERWRITE_MESSAGES,
  DOCUMENT_SAVE_MESSAGES,
  DOCUMENT_SOURCE_MESSAGES,
  DOCX_PREVIEW_MESSAGES,
  GENERIC_PREVIEW_MESSAGES,
  MEDIA_MESSAGES,
  recoveryDraftMessages,
  recoveryRestoreRefusal,
  RECOVERY_DRAFT_MESSAGES,
} from './failure-messages';
import { DocumentSaveError, DocumentSourceError, MediaError } from './ports';

const FAMILIES = [
  DOCUMENT_SOURCE_MESSAGES,
  DOCUMENT_SAVE_MESSAGES,
  DOCUMENT_OVERWRITE_MESSAGES,
  DOCUMENT_ASSET_MESSAGES,
  DOCX_PREVIEW_MESSAGES,
  MEDIA_MESSAGES,
  GENERIC_PREVIEW_MESSAGES,
  RECOVERY_DRAFT_MESSAGES,
  recoveryDraftMessages('plan.md'),
];

describe('documents failure messages', () => {
  it('gives every kind of every family a sentence a reader can act on', () => {
    for (const family of FAMILIES) {
      for (const sentence of Object.values(family)) {
        expect(sentence.length).toBeGreaterThan(0);
        expect(sentence.endsWith('.')).toBe(true);
      }
    }
  });

  it('says what happened to the reader’s bytes, per family', () => {
    expect(DOCUMENT_SAVE_MESSAGES.unavailable).toContain('still available');
    expect(DOCUMENT_OVERWRITE_MESSAGES.unavailable).toContain('Both versions');
    expect(DOCUMENT_SOURCE_MESSAGES.unavailable).toContain('has not been changed');
    expect(GENERIC_PREVIEW_MESSAGES.unavailable).toContain('has not been changed');
  });

  it('offers the conflict recovery only for a conflict', () => {
    expect(DOCUMENT_SAVE_MESSAGES.conflict).toContain('Retry to compare both versions');
    expect(DOCUMENT_SAVE_MESSAGES.conflict).not.toBe(DOCUMENT_SAVE_MESSAGES.unavailable);
  });

  it('reads a refusal on the named ladder by its kind', () => {
    const error = new DocumentSaveError('scope-lost', 'HTTP 409 stale version');
    expect(documentFailure(error, 'DocumentSaveError', DOCUMENT_SAVE_MESSAGES).message).toBe(
      DOCUMENT_SAVE_MESSAGES['scope-lost'],
    );
    expect(
      documentFailure<'unsupported-encoding'>(
        new DocumentSourceError('unsupported-encoding', 'binary'),
        'DocumentSourceError',
        DOCUMENT_SOURCE_MESSAGES,
      ).message,
    ).toBe(DOCUMENT_SOURCE_MESSAGES['unsupported-encoding']);
  });

  it('reads anything off the ladder as the family’s unavailable line', () => {
    expect(documentFailure(new Error('socket'), 'MediaError', MEDIA_MESSAGES).message).toBe(
      MEDIA_MESSAGES.unavailable,
    );
    expect(documentFailure('not an error', 'MediaError', MEDIA_MESSAGES).message).toBe(
      MEDIA_MESSAGES.unavailable,
    );
  });

  it('never suggests a journal refusal touched the file on disk', () => {
    for (const sentence of Object.values(RECOVERY_DRAFT_MESSAGES)) {
      expect(sentence).not.toContain('saved');
    }
    expect(RECOVERY_DRAFT_MESSAGES.disabled).toContain('installation');
    expect(recoveryRestoreRefusal('plan.md')).toContain('plan.md');
  });

  it('names the draft a decision was about, and only where the listing cannot', () => {
    const named = recoveryDraftMessages('plan.md');
    expect(named['not-found']).toContain('plan.md');
    expect(named.unavailable).toContain('plan.md');
    expect(named.disabled).toBe(RECOVERY_DRAFT_MESSAGES.disabled);
    expect(named['too-large']).toBe(RECOVERY_DRAFT_MESSAGES['too-large']);
  });

  it('refuses to read another capability’s failure as its own', () => {
    const other = new MediaError('scope-lost', 'a media refusal');
    expect(documentFailure(other, 'DocumentSaveError', DOCUMENT_SAVE_MESSAGES).message).toBe(
      DOCUMENT_SAVE_MESSAGES.unavailable,
    );
  });
});

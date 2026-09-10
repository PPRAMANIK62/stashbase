import { describe, expect, it } from 'vite-plus/test';

import { FeatureError } from '@/shared/domain/feature-error';

import { failureMessage, retrievalFailure } from './failure-messages';

describe('retrieval failure messages', () => {
  it('names every kind the retrieval ladder can report', () => {
    expect(failureMessage('not-set-up')).toBe('To search by meaning, set it up in StashBase Settings.');
    expect(failureMessage('quota-exhausted')).toContain('credits for search by meaning are used up');
    expect(failureMessage('scope-lost')).toContain('no longer available');
    expect(failureMessage('unauthorized')).toContain('no longer');
    expect(failureMessage('unavailable')).toBe('StashBase is unavailable.');
    expect(failureMessage('invalid-response')).toContain('unexpectedly');
  });

  it('reads a refusal through its kind and never repeats a raw message', () => {
    const refusal = new FeatureError('SemanticSearchError', 'quota-exhausted', 'raw detail');
    expect(retrievalFailure(refusal).message).toBe(failureMessage('quota-exhausted'));
    expect(retrievalFailure(new Error('boom')).message).toBe(failureMessage('unavailable'));
    expect(retrievalFailure(null).message).toBe(failureMessage('unavailable'));
  });

  it('separates a setup the reader can complete from a capability that is gone', () => {
    const notSetUp = new FeatureError('SemanticSearchError', 'not-set-up', 'raw detail');
    expect(retrievalFailure(notSetUp).tone).toBe('input');
    expect(retrievalFailure(new Error('boom')).tone).toBe('capability');
  });
});

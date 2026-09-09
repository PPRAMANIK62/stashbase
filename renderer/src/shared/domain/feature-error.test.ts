import { describe, expect, it } from 'vite-plus/test';

import {
  FeatureError,
  featureErrorClass,
  isFeatureError,
  readFailure,
  type FeatureFailureKind,
} from './feature-error';

const SaveError = featureErrorClass<'conflict'>('SaveError');
const ListError = featureErrorClass('ListError');

describe('feature errors', () => {
  it('reports the ladder name a minified build cannot read off the class', () => {
    const error = new SaveError('conflict', 'The file changed on disk.');

    expect(error.name).toBe('SaveError');
    expect(error.kind).toBe('conflict');
    expect(error.message).toBe('The file changed on disk.');
    expect(error).toBeInstanceOf(Error);
  });

  it('keeps each feature ladder its own class', () => {
    const save = new SaveError('unavailable', 'Saving is unavailable.');

    expect(save).toBeInstanceOf(SaveError);
    expect(save).toBeInstanceOf(FeatureError);
    expect(save).not.toBeInstanceOf(ListError);
  });

  it('carries the server sentence as the cause without surfacing it', () => {
    const cause = new Error('/private/path is gone');
    const error = new ListError('scope-lost', 'That folder is no longer available.', { cause });

    expect(error.cause).toBe(cause);
    expect(error.message).not.toContain('/private/path');
  });

  it('recognizes any feature failure, and one ladder by name', () => {
    const error = new SaveError('conflict', 'changed');

    expect(isFeatureError(error)).toBe(true);
    expect(isFeatureError(error, 'SaveError')).toBe(true);
    expect(isFeatureError(error, 'ListError')).toBe(false);
    expect(isFeatureError(new Error('plain'))).toBe(false);
    expect(isFeatureError(null)).toBe(false);
  });
});

const SAVE_MESSAGES: Readonly<Record<FeatureFailureKind<'conflict'>, string>> = {
  conflict: 'The file changed on disk.',
  'invalid-response': 'StashBase answered unexpectedly.',
  'scope-lost': 'That folder is no longer available.',
  unauthorized: 'This window can no longer save.',
  unavailable: 'StashBase is unavailable.',
};

describe('reading a failure', () => {
  it('selects the sentence by kind and never repeats what was thrown', () => {
    const error = new SaveError('conflict', 'HTTP 409 stale baseVersion=3');

    expect(readFailure<'conflict'>(error, SAVE_MESSAGES)).toEqual({
      message: SAVE_MESSAGES.conflict,
      tone: 'capability',
    });
  });

  it('reads anything that is not a feature failure as an unreachable capability', () => {
    expect(readFailure(new Error('socket hang up'), SAVE_MESSAGES).message).toBe(
      SAVE_MESSAGES.unavailable,
    );
    expect(readFailure(null, SAVE_MESSAGES).message).toBe(SAVE_MESSAGES.unavailable);
  });

  it('refuses to read another ladder as its own when an owner is named', () => {
    const other = new ListError('scope-lost', 'a list refusal');

    expect(readFailure(other, SAVE_MESSAGES, { owner: 'SaveError' }).message).toBe(
      SAVE_MESSAGES.unavailable,
    );
    expect(readFailure(other, SAVE_MESSAGES).message).toBe(SAVE_MESSAGES['scope-lost']);
  });

  it('separates the kinds a reader can fix from the ones they cannot', () => {
    const conflict = new SaveError('conflict', 'raw');

    expect(
      readFailure<'conflict'>(conflict, SAVE_MESSAGES, { inputKinds: ['conflict'] }).tone,
    ).toBe('input');
    expect(
      readFailure<'conflict'>(new SaveError('unavailable', 'raw'), SAVE_MESSAGES, {
        inputKinds: ['conflict'],
      }).tone,
    ).toBe('capability');
  });

  it('keeps the server sentence for the kinds only the server can explain', () => {
    const named = new SaveError('conflict', 'diagnostic', {
      cause: new Error('Download the transcription model first.'),
    });

    expect(
      readFailure<'conflict'>(named, SAVE_MESSAGES, { serverSentenceFor: ['conflict'] }).message,
    ).toBe('Download the transcription model first.');
    // The same refusal without a sentence falls back to the mapped line, and a
    // kind that was not named keeps the mapped line either way.
    expect(
      readFailure<'conflict'>(new SaveError('conflict', 'diagnostic'), SAVE_MESSAGES, {
        serverSentenceFor: ['conflict'],
      }).message,
    ).toBe(SAVE_MESSAGES.conflict);
    expect(readFailure<'conflict'>(named, SAVE_MESSAGES).message).toBe(SAVE_MESSAGES.conflict);
  });

  it('ignores a cause that carries no sentence worth reading', () => {
    const blank = new SaveError('conflict', 'diagnostic', { cause: new Error('   ') });

    expect(
      readFailure<'conflict'>(blank, SAVE_MESSAGES, { serverSentenceFor: ['conflict'] }).message,
    ).toBe(SAVE_MESSAGES.conflict);
  });
});

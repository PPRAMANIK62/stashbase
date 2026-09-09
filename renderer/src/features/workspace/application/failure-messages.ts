/**
 * One reader-facing sentence per workspace failure kind.
 *
 * Both workspace ladders are answered here: the library's bare transport kinds
 * and the files ladder that adds a name already taken and a name the server
 * refuses. A hook or a view selects by kind instead of forwarding an adapter's
 * own sentence or inventing a fallback, and each map covers the whole ladder,
 * so adding a kind fails the build here rather than shipping a silent blank.
 */
import type { LibraryFailureKind } from '@/features/workspace/domain/library';
import {
  readFailure,
  type FailureView,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';

import type { FilesFailureKind } from './ports';

const FILES_MESSAGES: Readonly<Record<FilesFailureKind, string>> = {
  conflict: 'Something with that name already exists.',
  'invalid-response': 'StashBase returned an unexpected response.',
  rejected: 'That name cannot be used.',
  'scope-lost': 'This folder is no longer available in this window.',
  unauthorized: 'This window can no longer access that folder.',
  unavailable: 'StashBase is unavailable.',
};

/** A taken name and a refused name are the reader's own request coming back. */
const FILES_INPUT_KINDS: readonly FilesFailureKind[] = ['conflict', 'rejected'];

/** The sentence one files failure kind reads as. */
export function failureMessage(kind: FilesFailureKind): string {
  return FILES_MESSAGES[kind];
}

/** The sentence and tone a refused file mutation shows. Anything that is not a
 *  files failure — a transport that threw, or a bug — reads as the unavailable
 *  line rather than repeating its own message. */
export function filesFailure(error: unknown): FailureView {
  return readFailure<'conflict' | 'rejected'>(error, FILES_MESSAGES, {
    inputKinds: FILES_INPUT_KINDS,
  });
}

/** What a refused saved-session read or write reads as. The desktop's own
 *  sentence names a path and travels only as the failure's cause. */
export const SESSION_MESSAGES: Readonly<Record<'load' | 'save', string>> = {
  load: 'StashBase could not read your saved session, so this window starts fresh.',
  save: "StashBase could not save this window's session.",
};

/** The sentence one workspace command reads as when a folder change could not
 *  go ahead because the window would have lost unsaved work. */
export const FOLDER_CHANGE_BLOCKED =
  'The folder could not be changed because a document could not be saved.';

/** A window still holding the folder open, and the delay another window may
 *  take to notice one that was removed. */
export const REMOVAL_MESSAGES = {
  blocked: 'A window could not release this folder. Resolve its save error and try again.',
  delayed: 'The folder was removed. Another window may take a moment to refresh.',
} as const;

/** The library picker reports one outcome the transport ladder cannot: the
 *  desktop could not put a folder chooser on screen at all. */
type LibraryCommandFailureKind = FeatureFailureKind<'fatal'>;

/** The sentence a refused library command shows. The verb names what did not
 *  happen; the kind decides why, so a `LibraryError`'s own transport sentence
 *  never reaches the reader. */
export function libraryFailureMessage(
  kind: LibraryFailureKind | 'fatal' | undefined,
  verb: 'opened' | 'removed',
): string {
  const messages: Readonly<Record<LibraryCommandFailureKind, string>> = {
    fatal: `StashBase could not ask for a folder, so none was ${verb}.`,
    'invalid-response': `StashBase returned an unexpected response, so the folder was not ${verb}.`,
    'scope-lost': `That folder is no longer in your library, so it could not be ${verb}.`,
    unauthorized: `This window can no longer change your library, so the folder was not ${verb}.`,
    unavailable: `StashBase is unavailable, so the folder was not ${verb}.`,
  };
  return messages[kind ?? 'unavailable'];
}

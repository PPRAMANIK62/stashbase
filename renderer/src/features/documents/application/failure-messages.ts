/**
 * One reader-facing sentence per documents failure family.
 *
 * Views ask a family for the sentence a `kind` deserves instead of carrying
 * their own English. A refusal's own message never reaches the reader — a
 * transport sentence is a diagnostic, not a recovery — so the kind alone
 * selects the line, and an unrecognised rejection falls through to the family's
 * `unavailable` one. Every map covers its whole ladder, so adding a kind fails
 * the build here rather than silently showing the wrong recovery.
 */
import { JsonEditError } from '@/features/documents/domain/json-edit';
import {
  readFailure,
  type FailureView,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';

import type {
  DocumentAssetFailureKind,
  DocumentSaveFailureKind,
  DocumentSourceFailureKind,
  DocxPreviewFailureKind,
  GenericFilePreviewFailureKind,
  MediaFailureKind,
} from './ports';

/** A family's whole ladder, mapped to the one sentence each kind reads as. */
export type FailureMessages<Extra extends string = never> = Readonly<
  Record<FeatureFailureKind<Extra>, string>
>;

export const DOCUMENT_SOURCE_MESSAGES: Readonly<Record<DocumentSourceFailureKind, string>> = {
  'invalid-response': 'The document could not be loaded. Your source file has not been changed.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer open that document.',
  unavailable: 'The document could not be loaded. Your source file has not been changed.',
  'unsupported-encoding':
    'This file is not text StashBase can decode. Its bytes have not been changed.',
};

export const DOCUMENT_SAVE_MESSAGES: Readonly<Record<DocumentSaveFailureKind, string>> = {
  conflict:
    'The file changed on disk, but its newer version could not be loaded. Retry to compare both versions.',
  'invalid-response': 'The document could not be saved. Your changes are still available.',
  'scope-lost': 'That folder is no longer available in this window, so the document was not saved.',
  unauthorized: 'This window can no longer save documents. Your changes are still available.',
  unavailable: 'The document could not be saved. Your changes are still available.',
};

/** Overwriting keeps both versions, so its wording differs from a plain save. */
export const DOCUMENT_OVERWRITE_MESSAGES: Readonly<Record<DocumentSaveFailureKind, string>> = {
  conflict: 'The document could not be overwritten. Both versions are still available.',
  'invalid-response': 'The document could not be overwritten. Both versions are still available.',
  'scope-lost': 'The document could not be overwritten. Both versions are still available.',
  unauthorized: 'The document could not be overwritten. Both versions are still available.',
  unavailable: 'The document could not be overwritten. Both versions are still available.',
};

export const DOCUMENT_ASSET_MESSAGES: Readonly<Record<DocumentAssetFailureKind, string>> = {
  'invalid-response': 'The file may have moved, changed, or become unavailable.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer open that file.',
  unavailable: 'The file may have moved, changed, or become unavailable.',
};

export const DOCX_PREVIEW_MESSAGES: Readonly<Record<DocxPreviewFailureKind, string>> = {
  'invalid-response': 'Direct preview unavailable. Showing the prepared version when it is ready.',
  'scope-lost': 'Direct preview unavailable. Showing the prepared version when it is ready.',
  timeout: 'Direct preview took too long. Showing the prepared version when it is ready.',
  unauthorized: 'Direct preview unavailable. Showing the prepared version when it is ready.',
  unavailable: 'Direct preview unavailable. Showing the prepared version when it is ready.',
};

export const MEDIA_MESSAGES: Readonly<Record<MediaFailureKind, string>> = {
  'invalid-response': 'The transcript could not be loaded.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer read that recording.',
  unavailable: 'The transcript could not be loaded.',
};

export const GENERIC_PREVIEW_MESSAGES: Readonly<Record<GenericFilePreviewFailureKind, string>> = {
  'invalid-response': 'The file could not be inspected. It has not been changed.',
  'not-generic': 'This document viewer is not available yet.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer inspect that file.',
  unavailable: 'The file could not be inspected. It has not been changed.',
};

/**
 * The sentence and tone one rejection shows. A failure raised on `owner`'s
 * ladder is read by its kind; anything else is an unexpected rejection and
 * reads as the family's unavailable line. Neither path repeats the thrown
 * message.
 */
export function documentFailure<Extra extends string = never>(
  error: unknown,
  owner: string,
  messages: FailureMessages<Extra>,
): FailureView {
  return readFailure<Extra>(error, messages, { owner });
}

/**
 * The sentence a refused JSON edit shows. The JSON domain authors these for the
 * reader — they name the key or path that could not be edited, which no fixed
 * line here could — so a refusal it raised keeps its own words. A rejection
 * from anywhere else is a bug and reads as the generic line.
 */
export function jsonEditFailureMessage(error: unknown): string {
  return error instanceof JsonEditError ? error.message : 'The JSON edit could not be applied.';
}

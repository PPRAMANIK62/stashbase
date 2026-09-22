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
import type { HumanizeRefusal } from '@/features/documents/domain/humanize';
import { JsonEditError } from '@/features/documents/domain/json-edit';
import type { RevisionRefusal } from '@/features/documents/domain/revision';
import {
  readFailure,
  type FailureView,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';

import type { RevisionPickupFailure } from './open-revision';
import type {
  DocumentAssetFailureKind,
  DocumentHumanizeFailureKind,
  DocumentSaveFailureKind,
  DocumentSourceFailureKind,
  DocxPreviewFailureKind,
  GenericFilePreviewFailureKind,
} from './ports';

/** A family's whole ladder, mapped to the one sentence each kind reads as. */
export type FailureMessages<Extra extends string = never> = Readonly<
  Record<FeatureFailureKind<Extra>, string>
>;

export const DOCUMENT_SOURCE_MESSAGES: Readonly<Record<DocumentSourceFailureKind, string>> = {
  missing: 'The source file is missing. Open work is still available; restore the file and retry.',
  'invalid-response': 'The document could not be loaded. Your source file has not been changed.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer open that document.',
  unavailable: 'The document could not be loaded. Your source file has not been changed.',
  'unsupported-encoding':
    'This file is not text StashBase can decode. Its bytes have not been changed.',
};

export const DOCUMENT_SAVE_MESSAGES: Readonly<Record<DocumentSaveFailureKind, string>> = {
  // The draft's destination is gone, which is a standing condition rather than
  // a write to repeat. The sentence names the risk and leaves the way out to
  // the action beside it.
  missing: 'The source file is gone, so this draft is not being saved.',
  conflict:
    'The file changed on disk, but its newer version could not be loaded. Retry to compare both versions.',
  'invalid-response': 'The document could not be saved. Your changes are still available.',
  'scope-lost': 'That folder is no longer available in this window, so the document was not saved.',
  unauthorized: 'This window can no longer save documents. Your changes are still available.',
  unavailable: 'The document could not be saved. Your changes are still available.',
};

/** Overwriting keeps both versions, so its wording differs from a plain save. */
export const DOCUMENT_OVERWRITE_MESSAGES: Readonly<Record<DocumentSaveFailureKind, string>> = {
  missing: 'The source file is missing. Open work is still available; restore the file and retry.',
  conflict: 'The document could not be overwritten. Both versions are still available.',
  'invalid-response': 'The document could not be overwritten. Both versions are still available.',
  'scope-lost': 'The document could not be overwritten. Both versions are still available.',
  unauthorized: 'The document could not be overwritten. Both versions are still available.',
  unavailable: 'The document could not be overwritten. Both versions are still available.',
};

export const DOCUMENT_ASSET_MESSAGES: Readonly<Record<DocumentAssetFailureKind, string>> = {
  missing: 'The source file is missing. Open work is still available; restore the file and retry.',
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

export const GENERIC_PREVIEW_MESSAGES: Readonly<Record<GenericFilePreviewFailureKind, string>> = {
  missing: 'The source file is missing. Open work is still available; restore the file and retry.',
  'invalid-response': 'The file could not be inspected. It has not been changed.',
  'not-generic': 'This document viewer is not available yet.',
  'scope-lost': 'That folder is no longer available in this window.',
  unauthorized: 'This window can no longer inspect that file.',
  unavailable: 'The file could not be inspected. It has not been changed.',
};

const HUMANIZE_UNAVAILABLE =
  'Humanize is not available right now. Your document has not been changed.';

/** Why a selection could not be humanized. `busy` and `too-long` are the
 *  reader's to act on; the rest is the service. Every one of them leaves the
 *  document as it was, and the sentence says so where the reader might doubt it. */
export const DOCUMENT_HUMANIZE_MESSAGES: Readonly<Record<DocumentHumanizeFailureKind, string>> = {
  busy: 'Humanize is busy right now. Try again in a minute.',
  'cut-off':
    'The rewrite was cut off before the end, so it was not offered. Select less text and try again.',
  'invalid-response': HUMANIZE_UNAVAILABLE,
  'scope-lost': HUMANIZE_UNAVAILABLE,
  'too-long': 'Select less text to humanize, up to about 1,000 words.',
  unauthorized: HUMANIZE_UNAVAILABLE,
  unavailable: HUMANIZE_UNAVAILABLE,
};

/** Why a rewrite that came back, or a selection that never left, did not
 *  open as a review. */
export const HUMANIZE_REFUSAL_MESSAGES: Readonly<Record<HumanizeRefusal, string>> = {
  changed: 'The document changed while the rewrite was running, so it was not offered. Try again.',
  empty: 'Select the text to humanize first.',
  'not-prose': 'Select prose to humanize: paragraphs, headings, quotes or lists.',
  unchanged: 'Hemmingway-1 left this text as it is.',
  unusable: 'The rewrite could not take the place of the selection, so it was not offered.',
};

/** Why a proposed revision could not be opened on the document in front of
 *  the reader. */
export const DOCUMENT_REVISION_MESSAGES: Readonly<Record<RevisionRefusal, string>> = {
  'frontmatter-changed':
    'That proposal changes Markdown frontmatter, which cannot be reviewed in place.',
  'no-changes': 'That proposal matches the document already, so there is nothing to review.',
  'not-editable': 'This document cannot be revised in place.',
  'review-in-progress': 'Finish the review already open on this document first.',
  'stale-version': 'The document has changed since that proposal was written.',
};

/** Why a proposal an agent parked never reached the reader. The host deletes
 *  a proposal the moment it hands it over, so one of these sentences is the
 *  only account of that work the reader will ever get, and each names the
 *  document so they know what to ask the agent for again. */
const DOCUMENT_REVISION_PICKUP_MESSAGES: Readonly<
  Record<RevisionPickupFailure | 'outside-folder', (name: string) => string>
> = {
  'frontmatter-changed': (name) =>
    `An agent revised ${name}, but its Markdown frontmatter cannot be reviewed in place.`,
  'no-changes': (name) =>
    `An agent revised ${name}, but the proposal matches the document already.`,
  'not-editable': (name) => `An agent revised ${name}, which cannot be revised in place.`,
  'not-opened': (name) => `An agent revised ${name}, but that document did not open here.`,
  'not-verified': (name) =>
    `An agent revised ${name}, but its current source could not be checked.`,
  'outside-folder': (name) =>
    `An agent revised ${name}, which is not in the folder this window has open.`,
  'review-in-progress': (name) =>
    `An agent revised ${name} again while its first review was still open.`,
  'stale-version': (name) => `An agent revised ${name}, which has changed since that was written.`,
};

/** The one thing every pickup failure has to end on, because it is the part
 *  the reader can act on. */
const REVISION_NOT_KEPT = 'The proposal was not kept, so ask the agent for it again.';

/** The sentence a reader sees when a proposal was taken from the host and
 *  could not be shown. `name` is the document's own name, not a path. */
export function documentRevisionPickupMessage(
  failure: RevisionPickupFailure | 'outside-folder',
  name: string,
): string {
  return `${DOCUMENT_REVISION_PICKUP_MESSAGES[failure](name)} ${REVISION_NOT_KEPT}`;
}

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

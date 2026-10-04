/**
 * Documents values only a test can want: the refusals a port raises, so the
 * app's own tests can make a save conflict or an expired turn the way the
 * transport does. The running app reads a refusal through the feature and
 * never constructs one.
 *
 * A dependency rule admits this entry only from a `*.test.*` file.
 */
export { DocumentSaveError, DocumentTurnChangesError } from './application/ports';

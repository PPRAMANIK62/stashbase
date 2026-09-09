/**
 * Documents values only a test can want: the refusal a source port raises, so
 * the app's own tests can make a save conflict the way the transport does. The
 * running app reads a refusal through `documentFailure` and never constructs
 * one.
 *
 * A dependency rule admits this entry only from a `*.test.*` file.
 */
export { DocumentSaveError } from './application/ports';

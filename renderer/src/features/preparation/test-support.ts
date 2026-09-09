/**
 * Preparation values only a test can want: the refusal a control port raises,
 * so the app's own tests can make one refuse the way the transport does, and
 * the query keys a test asserts staleness against. The running app reads a
 * refusal through `preparationFailure` and never constructs one.
 *
 * A dependency rule admits this entry only from a `*.test.*` file.
 */
export { PreparationError } from './application/ports';
export { preparationQueryKeys } from './application/queries';

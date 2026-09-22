/**
 * Humanize on a selection: what the reader is told while Hemmingway-1 works
 * and why a request never became a review.
 *
 * The rewrite itself is a revision review once it lands, so nothing here
 * duplicates that state. What is here is the stretch before it: one request
 * in flight, or the one sentence explaining why there is nothing to review.
 */

/** Why a rewrite was not opened as a review. Each is the reader's to act on
 *  or to know; none is a transport failure, which the port's ladder owns. */
export type HumanizeRefusal =
  /** The reader edited the document while the rewrite ran. A proposal built
   *  against the older text would strike the newer edits as deletions. */
  | 'changed'
  | 'empty'
  /** The selection covers a block Hemmingway-1 should not touch: code, a
   *  table, an image, raw HTML. */
  | 'not-prose'
  /** The rewrite parses to the same document. Nothing to accept or reject. */
  | 'unchanged'
  /** The rewrite could not take the selection's place in the document. */
  | 'unusable';

export type HumanizeStatus =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'failed'; message: string };

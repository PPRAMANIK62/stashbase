import { z } from 'zod';

/**
 * `GET /api/document-revisions` — the pending revision proposals a window picks
 * up for the folder it has open. `server/document-revisions.ts` owns why the
 * read consumes what it returns.
 *
 * Only the drain has a schema pair here. The tool that parks a proposal is a
 * project-file operation and validates in the host handler alongside write and
 * edit, so it stays with those routes rather than growing a second contract.
 */

/** The read carries no durable write, so an unknown query key is ignored rather
 *  than refused. A missing `folder` still fails: proposals are keyed by folder,
 *  and a drain with no folder would have to guess whose review to consume. */
export const documentRevisionsRequestSchema = z
  .object({ folder: z.string().trim().min(1) })
  .strip();

export const documentRevisionProposalSchema = z
  .object({
    /** Links the drained review to the exact Agent tool answer. */
    id: z.string().min(1),
    /** Absolute POSIX source path the proposal revises. The response's own
     *  `folder` says which project they were drained from. */
    path: z.string().min(1),
    /** The complete proposed document, not a fragment. */
    content: z.string(),
    /** `sha256:` version the proposal was computed against. */
    baseVersion: z.string().min(1),
    origin: z.literal('agent'),
    createdAt: z.number().int().nonnegative(),
  })
  .strip();

/** The response strips: a proposal is consumed by one renderer feature, so an
 *  unknown field has no reader and carrying it forward is dead weight. */
export const documentRevisionsResponseSchema = z
  .object({
    folder: z.string().min(1),
    proposals: z.array(documentRevisionProposalSchema),
  })
  .strip();

export type DocumentRevisionProposalWire = z.infer<typeof documentRevisionProposalSchema>;
export type DocumentRevisionsWire = z.infer<typeof documentRevisionsResponseSchema>;

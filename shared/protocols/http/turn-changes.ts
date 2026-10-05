import { z } from 'zod';

/**
 * `GET /api/turn-changes` — the text one Markdown file held before an Agent
 * turn, which the renderer reviews against the file on disk.
 * `server/turn-changes.ts` owns the record and why it expires.
 */

/** Every field names the record: the folder scopes it, the turn picks the
 *  recording, the path picks the file. An unknown query key is ignored because
 *  the read changes nothing. */
export const turnChangeRequestSchema = z
  .object({
    folder: z.string().trim().min(1),
    turn: z.string().trim().min(1).max(512),
    path: z.string().trim().min(1),
  })
  .strip();

export const turnChangeResponseSchema = z
  .object({
    folder: z.string().min(1),
    turnId: z.string().min(1),
    /** Absolute POSIX source path, as the `turn-changes` event named it. */
    path: z.string().min(1),
    /** A deleted file has nothing to open, so the route never answers one. */
    change: z.enum(['created', 'edited']),
    /** The whole document before the turn; empty for a file the turn created. */
    before: z.string(),
    /** `sha256:` version of the file as the turn left it. The renderer's source
     *  load returns the same token, so an unequal one means the file moved on
     *  after the turn and the review would compare against the wrong text. */
    afterVersion: z.string().min(1),
  })
  .strip();

export type TurnChangeWire = z.infer<typeof turnChangeResponseSchema>;

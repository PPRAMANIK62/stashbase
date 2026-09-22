import { z } from 'zod';

/**
 * `POST /api/humanize` — one selection of Markdown prose in, Hemmingway-1's
 * plain rewrite of it out. The host forwards the text to the rewrite service
 * on stashbase.ai and answers with the whole rewrite once it has all of it:
 * the renderer turns the answer into a revision proposal, and a proposal is
 * whole or nothing.
 *
 * The limits restate the service's own (`worker/index.mjs` in the website
 * repository): about 1,000 words of text and a short note. The host refuses
 * over-long input with 413 before it spends a request on it, and that status
 * is the one place the renderer learns the limit from.
 */

export const HUMANIZE_TEXT_LIMIT = 6000;
export const HUMANIZE_NOTE_LIMIT = 300;

export const humanizeRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(HUMANIZE_TEXT_LIMIT),
    note: z.string().trim().max(HUMANIZE_NOTE_LIMIT).optional(),
  })
  .strict();

/** The rewrite alone. A rewrite the service cut short never reaches here:
 *  the host refuses it with 422 rather than offering most of a paragraph. */
export const humanizeResponseSchema = z.object({ text: z.string().min(1) }).strip();

export type HumanizeRequestWire = z.infer<typeof humanizeRequestSchema>;
export type HumanizeResponseWire = z.infer<typeof humanizeResponseSchema>;

/** `POST /api/humanize`: the rewrite the Markdown surface asks for on a
 *  selection. No folder and no file are involved: the text comes from the
 *  reader's live buffer and the rewrite goes back to it as a proposal, so
 *  the route sits outside the folder gate and touches no source version.
 *  `server/humanize.ts` owns the service call and why a cut-off rewrite is
 *  refused. */
import type express from 'express';

import {
  HUMANIZE_TEXT_LIMIT,
  humanizeRequestSchema,
  humanizeResponseSchema,
} from '../../shared/protocols/http/humanize.ts';
import { humanizeText } from '../humanize.ts';
import { sendError } from '../http.ts';

export interface HumanizeRouteDependencies {
  humanize: (input: { text: string; note?: string | undefined }, signal: AbortSignal) => Promise<{ text: string }>;
}

/** An over-long selection is the one bad request the renderer acts on, so it
 *  gets its own status; anything else malformed is a bug in the caller. */
function tooLong(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'text' in body &&
    typeof body.text === 'string' &&
    body.text.trim().length > HUMANIZE_TEXT_LIMIT
  );
}

export function mount(
  app: express.Express,
  dependencies: HumanizeRouteDependencies = { humanize: (input, signal) => humanizeText(input, signal) },
): void {
  app.post('/api/humanize', async (req, res) => {
    const request = humanizeRequestSchema.safeParse(req.body ?? {});
    if (!request.success) {
      if (tooLong(req.body)) {
        res.status(413).json({ error: 'The selection is too long to rewrite.', code: 'HUMANIZE_TOO_LONG' });
      } else {
        res.status(400).json({ error: 'text must be a non-empty string', code: 'HUMANIZE_BAD_REQUEST' });
      }
      return;
    }
    // A reader who cancelled has nothing to receive, and the service should
    // stop spending on the rewrite too.
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });
    try {
      const result = await dependencies.humanize(request.data, controller.signal);
      if (controller.signal.aborted) return;
      res.json(humanizeResponseSchema.parse(result));
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      sendError(res, err);
    }
  });
}

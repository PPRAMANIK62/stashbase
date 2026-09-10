import { z } from 'zod';

/** The workspace window's one bug-report capability: ask main to open the
 *  review for the window that asked. Main derives the source from the sender;
 *  the request carries nothing. */
export const BUG_REPORT_CAPABILITY = 'bug-report.open';
export const BUG_REPORT_OPEN_CHANNEL = 'bug-report:open';

export const bugReportOpenResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      failure: z
        .object({
          kind: z.enum(['unauthorized', 'unavailable']),
          message: z.string().trim().min(1).max(240),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export type BugReportOpenResponse = z.infer<typeof bugReportOpenResponseSchema>;

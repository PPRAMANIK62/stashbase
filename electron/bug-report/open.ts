import type { BrowserWindow, IpcMain } from 'electron';

import {
  BUG_REPORT_CAPABILITY,
  BUG_REPORT_OPEN_CHANNEL,
  type BugReportOpenResponse,
  bugReportOpenResponseSchema,
} from '../../shared/protocols/electron/bug-report.ts';
import { authorizeSender, type SenderAuthorization } from '../library/dialog.ts';

export { BUG_REPORT_CAPABILITY };

export interface BugReportOpenDependencies extends SenderAuthorization {
  ipcMain: Pick<IpcMain, 'handle'>;
  /** Main owns the draft, the review window, and the source binding; the
   *  request carries nothing but the authorized sender window. */
  openReview(window: BrowserWindow): Promise<void>;
}

const failure = (
  kind: Exclude<BugReportOpenResponse, { ok: true }>['failure']['kind'],
  message: string,
): BugReportOpenResponse =>
  bugReportOpenResponseSchema.parse({ failure: { kind, message }, ok: false });

export function registerBugReportOpen(dependencies: BugReportOpenDependencies): void {
  dependencies.ipcMain.handle(
    BUG_REPORT_OPEN_CHANNEL,
    async (event): Promise<BugReportOpenResponse> => {
      const senderWindow = authorizeSender(event, dependencies, BUG_REPORT_CAPABILITY);
      if (!senderWindow) return failure('unauthorized', 'This window cannot start a bug report.');
      try {
        await dependencies.openReview(senderWindow);
        return bugReportOpenResponseSchema.parse({ ok: true });
      } catch {
        return failure('unavailable', 'StashBase could not open the bug report review.');
      }
    },
  );
}

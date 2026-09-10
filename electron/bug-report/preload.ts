import {
  BUG_REPORT_OPEN_CHANNEL,
  type BugReportOpenResponse,
  bugReportOpenResponseSchema,
} from '../../shared/protocols/electron/bug-report.ts';

export interface IpcRenderer {
  invoke(channel: string): Promise<unknown>;
}

export interface BugReportPreload {
  open(): Promise<BugReportOpenResponse>;
}

const unavailable = (): BugReportOpenResponse => ({
  failure: { kind: 'unavailable', message: 'The bug report review is unavailable.' },
  ok: false,
});

export function createBugReportPreload(ipcRenderer: IpcRenderer): BugReportPreload {
  return Object.freeze({
    async open() {
      try {
        const response = bugReportOpenResponseSchema.safeParse(
          await ipcRenderer.invoke(BUG_REPORT_OPEN_CHANNEL),
        );
        return response.success ? response.data : unavailable();
      } catch {
        return unavailable();
      }
    },
  });
}

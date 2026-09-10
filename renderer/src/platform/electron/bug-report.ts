import type { BugReportOpenResponse } from '@/protocols/electron/bug-report';

/** The workspace window's one bug-report capability: ask main to open the
 *  review for this window. Absent in the web build. */
export interface BugReportBridge {
  open(): Promise<BugReportOpenResponse>;
}

export function isBugReportBridge(value: unknown): value is BugReportBridge {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).open === 'function';
}

export interface PreparedBugReportText {
  ok: boolean;
  text?: string;
  redactionCount: number;
  findingCount?: number;
}

export function prepareBugReportText(
  input: unknown,
  options?: { homeDir?: string },
): PreparedBugReportText;

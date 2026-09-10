import { describe, expect, it } from 'vite-plus/test';

import { isBugReportBridge } from './bug-report';

describe('bug report bridge', () => {
  it('recognises only a capability with open', () => {
    expect(isBugReportBridge({ open: async () => ({ ok: true as const }) })).toBe(true);
    expect(isBugReportBridge({ open: 'later' })).toBe(false);
    expect(isBugReportBridge(null)).toBe(false);
    expect(isBugReportBridge(undefined)).toBe(false);
  });
});

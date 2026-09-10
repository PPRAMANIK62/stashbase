import { describe, expect, it, vi } from 'vite-plus/test';

import { createHtmlFrameFindController } from './find-controller';

describe('HTML frame Find controller', () => {
  it('accepts only the matching bounded response and releases pending work on disposal', async () => {
    const postMessage = vi.fn();
    const controller = createHtmlFrameFindController(() => ({ postMessage }));
    const result = controller.setQuery('local', { caseSensitive: true, wholeWord: false });
    const request = postMessage.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(request).toMatchObject({
      caseSensitive: true,
      op: 'set',
      query: 'local',
      type: 'stashbase-find',
      wholeWord: false,
    });
    expect(controller.accept({ ...request, current: -1, total: 1 })).toBe(false);
    expect(
      controller.accept({ type: 'stashbase-find-result', reqId: 999, current: 1, total: 1 }),
    ).toBe(false);
    expect(
      controller.accept({
        type: 'stashbase-find-result',
        reqId: request.reqId,
        current: 1,
        total: 2,
      }),
    ).toBe(true);
    await expect(result).resolves.toEqual({ current: 1, total: 2 });

    const pending = controller.next();
    controller.dispose();
    await expect(pending).resolves.toEqual({ current: 0, total: 0 });
  });
});

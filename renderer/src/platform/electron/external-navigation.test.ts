import { describe, expect, it, vi } from 'vite-plus/test';

import { createExternalNavigation } from './external-navigation';

describe('external navigation adapter', () => {
  it('maps the validated preload response without exposing transport details', async () => {
    const open = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        failure: { kind: 'unavailable', message: 'Browser unavailable.' },
        ok: false,
      });
    const navigation = createExternalNavigation({ open });

    await expect(navigation.open('https://example.com')).resolves.toBe(true);
    await expect(navigation.open('https://example.com/failure')).resolves.toBe(false);
  });
});

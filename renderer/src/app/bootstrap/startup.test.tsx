import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { mountApplication } from './startup';

describe('application startup', () => {
  afterEach(() => {
    document.body.replaceChildren();
    delete document.body.dataset.bootSettled;
    vi.restoreAllMocks();
  });

  it('shows an actionable host failure instead of an empty renderer', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const error = new Error('Electron bridge unavailable');
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const root = mountApplication(container, () => {
      throw error;
    });
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain('StashBase could not start');
    expect(container.textContent).toContain('Restart StashBase');
    expect(container.textContent).toContain('pnpm dev');
    expect(container.childElementCount).toBeGreaterThan(0);
    expect(document.body.dataset.bootSettled).toBe('1');
    expect(report).toHaveBeenCalledWith('StashBase renderer startup failed.', error);

    await act(async () => root.unmount());
  });
});

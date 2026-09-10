import { describe, expect, it, vi } from 'vite-plus/test';

import { writeToClipboard } from './clipboard';

describe('writeToClipboard', () => {
  it('hands the text to the host clipboard', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await writeToClipboard('sbk_9f3c');

    expect(writeText).toHaveBeenCalledWith('sbk_9f3c');
  });

  it('refuses when the host offers no clipboard', async () => {
    vi.stubGlobal('navigator', {});

    await expect(writeToClipboard('sbk_9f3c')).rejects.toThrow('The clipboard is unavailable.');
  });

  it('carries a refused write back to the caller', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
    });

    await expect(writeToClipboard('sbk_9f3c')).rejects.toThrow('denied');
  });
});

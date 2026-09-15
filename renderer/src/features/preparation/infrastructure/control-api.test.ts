import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createPreparationControlAdapter } from './control-api';

const source = { folderPath: '/project/research', path: 'papers/report.pdf' };
const signal = new AbortController().signal;

describe('preparation control API', () => {
  it('posts folder-explicit bodies and maps the reprocess mode', async () => {
    const request = vi.fn(async () => ({ body: { mode: 'conversion', ok: true }, status: 200 }));
    const mode = await createPreparationControlAdapter({ request }).reprocess(source, signal);
    expect(mode).toBe('conversion');
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { folder: '/project/research', path: 'papers/report.pdf' },
        method: 'POST',
        path: '/api/files/reprocess',
      }),
    );
  });

  it('classifies unsupported prepare formats and returns the cancel outcome', async () => {
    const unsupported: HttpClient = {
      request: vi.fn(async () => ({ body: { error: 'only DOCX' }, status: 415 })),
    };
    await expect(
      createPreparationControlAdapter(unsupported).prepare(source, signal),
    ).rejects.toMatchObject({ kind: 'unsupported' });
    const cancel: HttpClient = {
      request: vi.fn(async () => ({ body: { cancelled: true, ok: true }, status: 200 })),
    };
    await expect(createPreparationControlAdapter(cancel).cancel(source, signal)).resolves.toBe(
      true,
    );
  });

  it('syncs one explicit folder and reports a cut-short sync', async () => {
    const request = vi.fn(async () => ({
      body: { added: ['new.md'], cancelled: false },
      status: 200,
    }));
    await expect(
      createPreparationControlAdapter({ request }).sync('/project/research', signal),
    ).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/api/sync?folder=%2Fproject%2Fresearch' }),
    );
    const cancelled = vi.fn(async () => ({ body: { cancelled: true }, status: 200 }));
    await expect(
      createPreparationControlAdapter({ request: cancelled }).sync('/project/research', signal),
    ).resolves.toBe(false);
  });
});

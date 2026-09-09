import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createPreparationControlAdapter } from './control-api';

const source = { folderPath: '/library/research', path: 'talks/keynote.mp3' };
const signal = new AbortController().signal;

describe('preparation control API', () => {
  it('posts folder-explicit bodies and maps the reprocess mode', async () => {
    const request = vi.fn(async () => ({ body: { mode: 'conversion', ok: true }, status: 200 }));
    const mode = await createPreparationControlAdapter({ request }).reprocess(
      source,
      { language: 'en' },
      signal,
    );
    expect(mode).toBe('conversion');
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { folder: '/library/research', language: 'en', path: 'talks/keynote.mp3' },
        method: 'POST',
        path: '/api/files/reprocess',
      }),
    );
  });

  it('surfaces a blocked transcription runtime with the server reason', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: { code: 'TRANSCRIPTION_NOT_READY', error: 'Download the model first.' },
        status: 409,
      })),
    };
    await expect(
      createPreparationControlAdapter(client).reprocess(source, {}, signal),
    ).rejects.toMatchObject({ kind: 'blocked', message: 'Download the model first.' });
  });

  it('classifies unsupported prepare formats and returns the cancel outcome', async () => {
    const unsupported: HttpClient = {
      request: vi.fn(async () => ({ body: { error: 'only DOCX and media' }, status: 415 })),
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
      createPreparationControlAdapter({ request }).sync('/library/research', signal),
    ).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/api/sync?folder=%2Flibrary%2Fresearch' }),
    );
    const cancelled = vi.fn(async () => ({ body: { cancelled: true }, status: 200 }));
    await expect(
      createPreparationControlAdapter({ request: cancelled }).sync('/library/research', signal),
    ).resolves.toBe(false);
  });
});

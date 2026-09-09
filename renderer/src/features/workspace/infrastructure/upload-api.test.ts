import { describe, expect, it, vi } from 'vite-plus/test';

import { createUploadAdapter } from './upload-api';

const signal = new AbortController().signal;

describe('upload API', () => {
  it('posts multipart files with their folder and maps published paths', async () => {
    const fetchRequest = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ files: [{ file: 'clipboard-1.png' }] }), { status: 200 }),
    );
    const api = createUploadAdapter('http://127.0.0.1:43123', fetchRequest);
    const settled = await api.upload(
      '/library/research',
      [
        {
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
          name: 'clipboard-1.png',
        },
      ],
      signal,
    );
    expect(settled).toEqual(['clipboard-1.png']);
    const call = fetchRequest.mock.calls[0];
    if (!call) throw new Error('upload never reached fetch');
    const [url, init] = call;
    expect(String(url)).toBe('http://127.0.0.1:43123/api/upload');
    const form = init?.body as FormData;
    expect(form.get('folder')).toBe('/library/research');
    expect(form.getAll('paths')).toEqual(['clipboard-1.png']);
    expect((form.get('files') as File).name).toBe('clipboard-1.png');
  });

  it('raises a per-file refusal on the files ladder instead of resolving with it', async () => {
    const fetchRequest = vi.fn(
      async () =>
        new Response(JSON.stringify({ files: [{ error: 'unsupported type', file: 'x.bin' }] }), {
          status: 200,
        }),
    );
    await expect(
      createUploadAdapter('http://127.0.0.1:43123', fetchRequest).upload('/library', [], signal),
    ).rejects.toMatchObject({ kind: 'rejected' });
  });

  it('classifies a missing folder as a lost scope', async () => {
    const fetchRequest = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'FOLDER_NOT_FOUND', error: 'folder not found' }), {
          status: 404,
        }),
    );
    await expect(
      createUploadAdapter('http://127.0.0.1:43123', fetchRequest).upload('/gone', [], signal),
    ).rejects.toMatchObject({ kind: 'scope-lost', message: 'folder not found' });
  });
});

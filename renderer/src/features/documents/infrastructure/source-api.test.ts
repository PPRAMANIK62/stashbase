import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createDocumentSourceApi } from './source-api';

describe('document source API', () => {
  it('loads explicit-folder Markdown and retains the byte version', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: {
          content: '# Plan\n',
          format: 'md',
          name: 'drafts/plan #1.markdown',
          version: 'sha256:abc',
        },
        status: 200,
      })),
    };
    const signal = new AbortController().signal;
    const api = createDocumentSourceApi(client);

    await expect(
      api.load({ folderPath: '/library/research notes', path: 'drafts/plan #1.markdown' }, signal),
    ).resolves.toEqual({ content: '# Plan\n', format: 'md', version: 'sha256:abc' });
    expect(client.request).toHaveBeenCalledWith({
      path: '/api/files/drafts/plan%20%231.markdown?folder=%2Flibrary%2Fresearch+notes',
      signal,
    });
  });

  it('keeps invalid UTF-8 TXT explicit and never returns replacement text', async () => {
    const api = createDocumentSourceApi({
      request: vi.fn(async () => ({
        body: {
          content: '',
          error: { code: 'UNSUPPORTED_ENCODING', message: 'private server detail' },
          format: 'txt',
          name: 'legacy.txt',
          version: 'sha256:def',
        },
        status: 200,
      })),
    });

    await expect(
      api.load({ folderPath: '/library/notes', path: 'legacy.txt' }, new AbortController().signal),
    ).rejects.toMatchObject({
      kind: 'unsupported-encoding',
      message: 'This text file is not valid UTF-8. It remains unchanged and read-only.',
    });
  });

  it('rejects mismatched identities and classifies lost folder scope', async () => {
    const mismatched = createDocumentSourceApi({
      request: vi.fn(async () => ({
        body: { content: 'wrong', format: 'txt', name: 'other.txt', version: 'v1' },
        status: 200,
      })),
    });
    await expect(
      mismatched.load(
        { folderPath: '/library/notes', path: 'notes.txt' },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' });

    const lost = createDocumentSourceApi({
      request: vi.fn(async () => ({
        body: { code: 'FOLDER_UNAVAILABLE', error: 'private server detail' },
        status: 410,
      })),
    });
    await expect(
      lost.load({ folderPath: '/library/notes', path: 'notes.txt' }, new AbortController().signal),
    ).rejects.toMatchObject({
      kind: 'scope-lost',
      message: 'The document folder is no longer available in this window.',
    });
  });

  it('rejects an invalid source identity before transport', async () => {
    const client: HttpClient = { request: vi.fn() };
    const api = createDocumentSourceApi(client);

    await expect(
      api.load({ folderPath: ' ', path: 'notes.txt' }, new AbortController().signal),
    ).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'The document identity is invalid.',
    });
    expect(client.request).not.toHaveBeenCalled();
  });
});

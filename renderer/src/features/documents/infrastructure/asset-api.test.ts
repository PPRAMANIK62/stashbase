import { describe, expect, it, vi } from 'vite-plus/test';

import { DocumentAssetError } from '@/features/documents/application/ports';
import type { HttpClient } from '@/platform/http/client';

import { createDocumentAssetApi } from './asset-api';

describe('document asset API', () => {
  it('resolves a version-keyed explicit-folder asset URL', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: null,
        headers: { 'x-stashbase-file-version': 'v 2' },
        status: 204,
      })),
    };
    const api = createDocumentAssetApi(client, 'http://127.0.0.1:8090');

    await expect(
      api.load(
        { folderPath: '/library/archive', path: 'images/cover one.png' },
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      kind: 'source',
      url: 'http://127.0.0.1:8090/asset/__folder/%252Flibrary%252Farchive/images/cover%20one.png?v=v+2',
      version: 'v 2',
    });
    expect(client.request).toHaveBeenCalledWith({
      method: 'HEAD',
      path: '/api/files/images/cover%20one.png?folder=%2Flibrary%2Farchive',
      signal: expect.any(AbortSignal),
    });
  });

  it('adds the prepared fallback only for DOCX assets', async () => {
    const client: HttpClient = {
      request: vi.fn(async () => ({
        body: null,
        headers: { 'x-stashbase-file-version': 'v1' },
        status: 204,
      })),
    };
    const api = createDocumentAssetApi(client, 'http://127.0.0.1:8090');

    await expect(
      api.load(
        { folderPath: '/library', path: 'reports/summary.docx' },
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      fallbackUrl:
        'http://127.0.0.1:8090/asset-derived/__folder/%252Flibrary/reports/summary.docx?v=v1',
      kind: 'docx',
      url: 'http://127.0.0.1:8090/asset/__folder/%252Flibrary/reports/summary.docx?v=v1',
      version: 'v1',
    });
  });

  it('adds a compatible audio fallback for media assets', async () => {
    const api = createDocumentAssetApi(
      {
        request: vi.fn(async () => ({
          body: null,
          headers: { 'x-stashbase-file-version': 'v1' },
          status: 204,
        })),
      },
      'http://127.0.0.1:8090',
    );

    await expect(
      api.load(
        { folderPath: '/library', path: 'recordings/demo.mp4' },
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      fallbackUrl:
        'http://127.0.0.1:8090/asset-audio-preview/__folder/%252Flibrary/recordings/demo.mp4?v=v1',
      kind: 'media',
      url: 'http://127.0.0.1:8090/asset/__folder/%252Flibrary/recordings/demo.mp4?v=v1',
      version: 'v1',
    });
  });

  it('rejects missing versions and lost scopes', async () => {
    const invalid = createDocumentAssetApi(
      { request: vi.fn(async () => ({ body: null, status: 204 })) },
      'http://127.0.0.1:8090',
    );
    await expect(
      invalid.load({ folderPath: '/library', path: 'paper.pdf' }, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'invalid-response' } satisfies Partial<DocumentAssetError>);

    const lost = createDocumentAssetApi(
      { request: vi.fn(async () => ({ body: null, status: 410 })) },
      'http://127.0.0.1:8090',
    );
    await expect(
      lost.load({ folderPath: '/library', path: 'paper.pdf' }, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'scope-lost' } satisfies Partial<DocumentAssetError>);
  });
});

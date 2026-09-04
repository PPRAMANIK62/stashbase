import { DocumentAssetError, type DocumentAssetApi } from '@/features/documents/application/ports';
import { documentViewerFormat } from '@/features/documents/domain/document-format';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import { documentTextSourceRequestSchema } from '@/protocols/http/files';

function encodePath(entryPath: string): string {
  return entryPath.split('/').map(encodeURIComponent).join('/');
}

function responseError(response: HttpResponse): DocumentAssetError {
  if (response.status === 401 || response.status === 403) {
    return new DocumentAssetError('unauthorized', 'This window can no longer preview that file.');
  }
  if (response.status === 410 || response.status === 412) {
    return new DocumentAssetError(
      'scope-lost',
      'The file folder is no longer available in this window.',
    );
  }
  return new DocumentAssetError('unavailable', 'The file could not be loaded.');
}

function assetPath(
  prefix: '/asset' | '/asset-audio-preview' | '/asset-derived',
  folderPath: string,
  entryPath: string,
): string {
  const folder = encodeURIComponent(encodeURIComponent(folderPath));
  return `${prefix}/__folder/${folder}/${encodePath(entryPath)}`;
}

export function createDocumentAssetApi(client: HttpClient, serverOrigin: string): DocumentAssetApi {
  const origin = new URL(serverOrigin);
  return {
    async load(source, signal) {
      const request = documentTextSourceRequestSchema.safeParse(source);
      if (!request.success) {
        throw new DocumentAssetError('unavailable', 'The file identity is invalid.');
      }
      const query = new URLSearchParams({ folder: request.data.folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({
          method: 'HEAD',
          path: `/api/files/${encodePath(request.data.path)}?${query}`,
          signal,
        });
      } catch (error) {
        if (error instanceof DocumentAssetError || signal.aborted) throw error;
        throw new DocumentAssetError('unavailable', 'The file could not be loaded.', {
          cause: error,
        });
      }
      if (response.status < 200 || response.status >= 300) throw responseError(response);
      const version = response.headers?.['x-stashbase-file-version'];
      if (!version) {
        throw new DocumentAssetError(
          'invalid-response',
          'The file preview returned an invalid version.',
        );
      }
      const url = new URL(assetPath('/asset', request.data.folderPath, request.data.path), origin);
      url.searchParams.set('v', version);
      const format = documentViewerFormat(request.data.path);
      if (format !== 'docx' && format !== 'media') {
        return { kind: 'source', url: url.href, version };
      }
      if (format === 'media') {
        const fallbackUrl = new URL(
          assetPath('/asset-audio-preview', request.data.folderPath, request.data.path),
          origin,
        );
        fallbackUrl.searchParams.set('v', version);
        return { fallbackUrl: fallbackUrl.href, kind: 'media', url: url.href, version };
      }
      const fallbackUrl = new URL(
        assetPath('/asset-derived', request.data.folderPath, request.data.path),
        origin,
      );
      fallbackUrl.searchParams.set('v', version);
      return { fallbackUrl: fallbackUrl.href, kind: 'docx', url: url.href, version };
    },
  };
}

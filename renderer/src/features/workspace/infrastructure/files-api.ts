import { FilesError, type FilesApi } from '@/features/workspace/application/ports';
import type { WorkspaceListing } from '@/features/workspace/domain/tree';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  workspaceFailureSchema,
  workspaceFilesSchema,
  workspaceRevealResponseSchema,
  type WorkspaceFilesWire,
} from '@/protocols/http/files';

function mapListing(listing: WorkspaceFilesWire): WorkspaceListing {
  return {
    files: listing.files.map((file) => ({
      availability: file.availability ?? 'available',
      format: file.format,
      heading: file.heading,
      importedAt: file.imported_at,
      kind: file.entryKind ?? 'regular',
      path: file.name,
      size: file.size,
      snippet: file.snippet,
    })),
    folderName: listing.folder,
    folders: listing.folders.map((folder) => ({
      kind: folder.kind ?? 'normal',
      path: folder.path,
    })),
  };
}

function operationError(response: HttpResponse): FilesError {
  const failure = workspaceFailureSchema.safeParse(response.body);
  const unauthorized =
    response.status === 401 || response.status === 403 || response.status === 410;
  return new FilesError(
    unauthorized ? 'unauthorized' : 'unavailable',
    unauthorized ? 'This window can no longer access that folder.' : 'The files are unavailable.',
    failure.success ? { cause: new Error(failure.data.error) } : undefined,
  );
}

function encodePath(entryPath: string): string {
  return entryPath.split('/').map(encodeURIComponent).join('/');
}

export function createFilesApi(client: HttpClient): FilesApi {
  return {
    async load(folderPath, signal) {
      const query = new URLSearchParams({ folder: folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({ path: `/api/files?${query}`, signal });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new FilesError('unavailable', 'The files are unavailable.', { cause: error });
      }
      if (response.status < 200 || response.status >= 300) throw operationError(response);
      const listing = workspaceFilesSchema.safeParse(response.body);
      if (!listing.success) {
        throw new FilesError('invalid-response', 'The folder returned an invalid file listing.');
      }
      return mapListing(listing.data);
    },
    async reveal(entryPath, signal) {
      let response: HttpResponse;
      try {
        response = await client.request({
          method: 'POST',
          path: `/api/reveal/${encodePath(entryPath)}`,
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new FilesError('unavailable', 'The item could not be shown.', { cause: error });
      }
      if (response.status < 200 || response.status >= 300) throw operationError(response);
      if (!workspaceRevealResponseSchema.safeParse(response.body).success) {
        throw new FilesError(
          'invalid-response',
          'The reveal operation returned an invalid response.',
        );
      }
    },
  };
}

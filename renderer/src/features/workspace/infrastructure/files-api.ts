import { FilesError, type FilesApi } from '@/features/workspace/application/ports';
import { joinTreePath, type WorkspaceListing } from '@/features/workspace/domain/tree';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  workspaceCreateEntryRequestSchema,
  workspaceDeleteEntryResponseSchema,
  workspaceEntryPathResponseSchema,
  workspaceEntryRequestSchema,
  workspaceFailureSchema,
  workspaceFilesSchema,
  workspaceRenameEntryRequestSchema,
  workspaceRevealRequestSchema,
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
  const folderChanged =
    response.status === 409 && failure.success && failure.data.code === 'FOLDER_CHANGED';
  const scopeLost =
    response.status === 412 ||
    folderChanged ||
    (response.status === 410 && failure.success && failure.data.code === 'FOLDER_UNAVAILABLE');
  const unauthorized =
    response.status === 401 || response.status === 403 || response.status === 410;
  const conflict = response.status === 409 && !folderChanged;
  const rejected = response.status === 400 || response.status === 404 || response.status === 415;
  return new FilesError(
    scopeLost
      ? 'scope-lost'
      : unauthorized
        ? 'unauthorized'
        : conflict
          ? 'conflict'
          : rejected
            ? 'rejected'
            : 'unavailable',
    scopeLost
      ? 'This folder is no longer available in this window.'
      : unauthorized
        ? 'This window can no longer access that folder.'
        : conflict
          ? 'Something with that name already exists.'
          : rejected
            ? 'That name cannot be used.'
            : 'The files are unavailable.',
    failure.success ? { cause: new Error(failure.data.error) } : undefined,
  );
}

function encodePath(entryPath: string): string {
  return entryPath.split('/').map(encodeURIComponent).join('/');
}

function folderQuery(folderPath: string): string {
  return new URLSearchParams({ folder: folderPath }).toString();
}

/** Sends one mutation, mapping transport failure, refusal, and a malformed
 *  success body onto the files failure ladder. */
async function mutate<Result>(
  client: HttpClient,
  request: { body?: unknown; method: 'POST' | 'PATCH' | 'DELETE'; path: string },
  signal: AbortSignal,
  parse: (body: unknown) => Result | null,
  messages: { invalid: string; unavailable: string },
): Promise<Result> {
  let response: HttpResponse;
  try {
    response = await client.request({ ...request, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new FilesError('unavailable', messages.unavailable, { cause: error });
  }
  if (response.status < 200 || response.status >= 300) throw operationError(response);
  const result = parse(response.body);
  if (result === null) throw new FilesError('invalid-response', messages.invalid);
  return result;
}

function entryPath(body: unknown): { path: string } | null {
  const parsed = workspaceEntryPathResponseSchema.safeParse(body);
  const path: string | undefined = parsed.success
    ? (parsed.data.name ?? parsed.data.path)
    : undefined;
  return path === undefined ? null : { path };
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
    async reveal(folderPath, entryPath, signal) {
      const request = workspaceRevealRequestSchema.safeParse({ folderPath, path: entryPath });
      if (!request.success) {
        throw new FilesError('unavailable', 'The item identity is invalid.');
      }
      const query = new URLSearchParams({ folder: request.data.folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({
          method: 'POST',
          path: `/api/reveal/${encodePath(request.data.path)}?${query}`,
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
    async createEntry(folderPath, kind, parentPath, name, signal) {
      const request = workspaceCreateEntryRequestSchema.safeParse({
        folderPath,
        kind,
        name,
        parentPath,
      });
      if (!request.success) throw new FilesError('rejected', 'That name cannot be used.');
      const { data } = request;
      return mutate(
        client,
        data.kind === 'file'
          ? {
              body: { dir: data.parentPath, name: data.name },
              method: 'POST',
              path: `/api/files?${folderQuery(data.folderPath)}`,
            }
          : {
              body: { path: joinTreePath(data.parentPath, data.name) },
              method: 'POST',
              path: `/api/folders?${folderQuery(data.folderPath)}`,
            },
        signal,
        entryPath,
        {
          invalid: 'The create operation returned an invalid response.',
          unavailable: `The ${data.kind} could not be created.`,
        },
      );
    },
    async renameEntry(folderPath, entry, name, signal) {
      const request = workspaceRenameEntryRequestSchema.safeParse({
        folderPath,
        kind: entry.kind,
        name,
        path: entry.path,
      });
      if (!request.success) throw new FilesError('rejected', 'That name cannot be used.');
      const { data } = request;
      return mutate(
        client,
        {
          body: { new_name: data.name },
          method: 'PATCH',
          path: `/api/${data.kind === 'file' ? 'files' : 'folders'}/${encodePath(data.path)}?${folderQuery(data.folderPath)}`,
        },
        signal,
        entryPath,
        {
          invalid: 'The rename operation returned an invalid response.',
          unavailable: `The ${data.kind} could not be renamed.`,
        },
      );
    },
    async deleteEntry(folderPath, entry, signal) {
      const request = workspaceEntryRequestSchema.safeParse({
        folderPath,
        kind: entry.kind,
        path: entry.path,
      });
      if (!request.success) throw new FilesError('rejected', 'The item identity is invalid.');
      const { data } = request;
      await mutate(
        client,
        {
          method: 'DELETE',
          path: `/api/${data.kind === 'file' ? 'files' : 'folders'}/${encodePath(data.path)}?${folderQuery(data.folderPath)}`,
        },
        signal,
        (body) => (workspaceDeleteEntryResponseSchema.safeParse(body).success ? {} : null),
        {
          invalid: 'The delete operation returned an invalid response.',
          unavailable: `The ${data.kind} could not be deleted.`,
        },
      );
    },
  };
}

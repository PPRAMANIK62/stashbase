import { type LibraryApi, LibraryError } from '@/features/workspace/application/ports';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  libraryFailureSchema,
  libraryOpenFolderRequestSchema,
  librarySnapshotSchema,
} from '@/protocols/http/library';
import type { LibrarySnapshotWire } from '@/protocols/http/library';

function mapSnapshot(snapshot: LibrarySnapshotWire): LibrarySnapshot {
  return {
    activeFolder: snapshot.current,
    homeDirectory: snapshot.homeDir,
    members: snapshot.recent.map((member) => ({
      favorite: member.favorite === true,
      openedAt: member.openedAt,
      path: member.path,
    })),
  };
}

function mapResponse(response: HttpResponse): LibrarySnapshot {
  if (response.status >= 200 && response.status < 300) {
    const snapshot = librarySnapshotSchema.safeParse(response.body);
    if (snapshot.success) return mapSnapshot(snapshot.data);
    throw new LibraryError('invalid-response', 'The library returned an invalid response.');
  }
  const failure = libraryFailureSchema.safeParse(response.body);
  const unauthorized =
    response.status === 401 || response.status === 403 || response.status === 410;
  throw new LibraryError(
    unauthorized ? 'unauthorized' : 'unavailable',
    unauthorized ? 'This window can no longer open folders.' : 'The library is unavailable.',
    failure.success ? { cause: new Error(failure.data.error) } : undefined,
  );
}

export function createLibraryApi(client: HttpClient): LibraryApi {
  const request = async (
    path: string,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<LibrarySnapshot> => {
    try {
      return mapResponse(
        await client.request({
          ...(body === undefined ? {} : { body, method: 'POST' }),
          path,
          signal,
        }),
      );
    } catch (error) {
      if (error instanceof LibraryError || signal.aborted) throw error;
      throw new LibraryError('unavailable', 'The library is unavailable.', {
        cause: error,
      });
    }
  };

  return {
    load: (signal) => request('/api/library', signal),
    openFolder: (path, signal) =>
      request('/api/library/folders/open', signal, libraryOpenFolderRequestSchema.parse({ path })),
  };
}

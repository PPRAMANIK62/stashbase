import { type LibraryPort, LibraryError } from '@/features/workspace/application/ports';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import { request, type TransportFailure } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  libraryFailureSchema,
  libraryOpenFolderRequestSchema,
  libraryRemoveFolderRequestSchema,
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

/** The library owns no folder scope of its own, so a refusal is either the
 *  window losing its grant or the library itself being unreachable. */
function libraryFailure({ response, serverMessage }: TransportFailure): LibraryError {
  const retired = response.status === 401 || response.status === 403 || response.status === 410;
  return new LibraryError(
    retired ? 'unauthorized' : 'unavailable',
    retired ? 'This window can no longer open folders.' : 'The library is unavailable.',
    serverMessage === null ? undefined : { cause: new Error(serverMessage) },
  );
}

export function createLibraryAdapter(client: HttpClient): LibraryPort {
  const snapshot = async (
    path: string,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<LibrarySnapshot> =>
    mapSnapshot(
      await request(client, {
        ...(body === undefined ? {} : { body, method: 'POST' as const }),
        error: LibraryError,
        failure: libraryFailure,
        failureSchema: libraryFailureSchema,
        messages: {
          'invalid-response': 'The library returned an invalid response.',
          unavailable: 'The library is unavailable.',
        },
        path,
        schema: librarySnapshotSchema,
        signal,
      }),
    );

  return {
    load: (signal) => snapshot('/api/library', signal),
    openFolder: (path, signal) =>
      snapshot('/api/library/folders/open', signal, libraryOpenFolderRequestSchema.parse({ path })),
    removeFolder: (path, signal) =>
      snapshot(
        '/api/library/folders/remove',
        signal,
        libraryRemoveFolderRequestSchema.parse({ path }),
      ),
  };
}

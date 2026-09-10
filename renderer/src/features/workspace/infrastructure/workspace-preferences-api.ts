/**
 * The Workbench visibility transport.
 *
 * The route answers every read and write with the state it actually applied,
 * so both sides of this adapter return that answer rather than the value that
 * was asked for. A window therefore cannot end up showing rows one way and a
 * menu the other.
 */
import { FilesError, type WorkspacePreferencesPort } from '@/features/workspace/application/ports';
import {
  request,
  requestOptions,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  workspacePreferencesRequestSchema,
  workspacePreferencesSchema,
} from '@/protocols/http/workspace-preferences';

/** A refused preference is the reader's own request coming back, not a lost
 *  capability, so it reads as the files ladder's `rejected`. */
function refused(fallback: string) {
  return ({ response, serverMessage }: TransportFailure): FilesError | null =>
    response.status === 400 ? new FilesError('rejected', serverMessage ?? fallback) : null;
}

function preferences(
  signal: AbortSignal,
  fallback: string,
): TransportRequest<'conflict' | 'rejected'> {
  return requestOptions({
    error: FilesError,
    failure: refused(fallback),
    messages: {
      'invalid-response': 'Workbench preferences returned an invalid response.',
      unavailable: fallback,
    },
    path: '/api/workspace-preferences',
    serverMessage: true,
    signal,
  });
}

export function createWorkspacePreferencesAdapter(client: HttpClient): WorkspacePreferencesPort {
  return {
    async load(signal) {
      const parsed = await request(client, {
        ...preferences(signal, 'Workbench preferences are unavailable.'),
        schema: workspacePreferencesSchema,
      });
      return parsed.showHiddenFiles;
    },
    async setShowHiddenFiles(next, signal) {
      const parsed = await request(client, {
        ...preferences(signal, 'That preference could not be saved.'),
        body: workspacePreferencesRequestSchema.parse({ showHiddenFiles: next }),
        method: 'PUT',
        schema: workspacePreferencesSchema,
      });
      return parsed.showHiddenFiles;
    },
  };
}

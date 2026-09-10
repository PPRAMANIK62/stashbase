/**
 * The HTTP adapter for the server's recovery journal. Two refusals are the
 * journal's own — no OS-protected key on this installation, and a snapshot
 * past the size bound — and both are classified here so nothing above the
 * seam reads a status code.
 */
import {
  RecoveryDraftError,
  type RecoveryDraftListing,
  type RecoveryDraftPort,
  type RecoveryDraftSummary,
} from '@/features/documents/application/ports';
import { request, type TransportFailure, type TransportRequest } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  recoveryDraftContentResponseSchema,
  recoveryDraftDiscardResponseSchema,
  recoveryDraftFailureSchema,
  recoveryDraftIdentitySchema,
  recoveryDraftListResponseSchema,
  recoveryDraftWriteRequestSchema,
  recoveryDraftWriteResponseSchema,
  type RecoveryDraftSummaryWire,
} from '@/protocols/http/recovery-drafts';
import type { SourceReference } from '@/shared/domain/source-reference';

const MESSAGES = {
  'invalid-response': 'The recovery journal returned an invalid response.',
  'scope-lost': 'That folder is no longer part of the library.',
  unauthorized: 'This window can no longer use the recovery journal.',
  unavailable: 'The recovery journal could not be reached.',
};

function cause(serverMessage: string | null): ErrorOptions | undefined {
  return serverMessage === null ? undefined : { cause: new Error(serverMessage) };
}

function journalFailure({ response, serverMessage }: TransportFailure): RecoveryDraftError | null {
  const failure = recoveryDraftFailureSchema.safeParse(response.body);
  const code = failure.success ? failure.data.code : undefined;
  if (response.status === 503 || code === 'RECOVERY_UNAVAILABLE') {
    return new RecoveryDraftError(
      'disabled',
      'Draft recovery is unavailable on this installation.',
      cause(serverMessage),
    );
  }
  if (response.status === 413 || code === 'DRAFT_TOO_LARGE') {
    return new RecoveryDraftError(
      'too-large',
      'This draft is too large for the recovery journal.',
      cause(serverMessage),
    );
  }
  if (response.status === 404 || code === 'NOT_FOUND') {
    return new RecoveryDraftError(
      'not-found',
      'That draft is no longer in the recovery journal.',
      cause(serverMessage),
    );
  }
  if (code === 'FOLDER_UNAVAILABLE' || code === 'INVALID_PATH') {
    return new RecoveryDraftError('scope-lost', MESSAGES['scope-lost'], cause(serverMessage));
  }
  return null;
}

function call(
  path: string,
  signal: AbortSignal,
  rest: Pick<TransportRequest<'disabled' | 'not-found' | 'too-large'>, 'body' | 'method'> = {},
): TransportRequest<'disabled' | 'not-found' | 'too-large'> {
  return {
    ...rest,
    error: RecoveryDraftError,
    failure: journalFailure,
    failureSchema: recoveryDraftFailureSchema,
    messages: MESSAGES,
    path,
    signal,
  };
}

function identityQuery(source: SourceReference): string {
  const identity = recoveryDraftIdentitySchema.safeParse(source);
  if (!identity.success) {
    throw new RecoveryDraftError('unavailable', 'The draft identity is invalid.');
  }
  return new URLSearchParams({
    folder: identity.data.folderPath,
    path: identity.data.path,
  }).toString();
}

/** The server answers with the folder's stored spelling, which membership
 *  already tied to the folder that was asked about; the renderer keeps its own
 *  spelling so the candidate matches the workspace that will open it. */
function summary(folderPath: string, wire: RecoveryDraftSummaryWire): RecoveryDraftSummary {
  return {
    currentVersion: wire.currentVersion,
    expectedVersion: wire.expectedVersion,
    savedAt: wire.savedAt,
    source: { folderPath, path: wire.path },
  };
}

export function createRecoveryDraftAdapter(client: HttpClient): RecoveryDraftPort {
  return {
    async discard(source, signal) {
      await request(client, {
        ...call(`/api/recovery-drafts?${identityQuery(source)}`, signal, { method: 'DELETE' }),
        schema: recoveryDraftDiscardResponseSchema,
      });
    },
    async list(folderPath, signal): Promise<RecoveryDraftListing> {
      const query = new URLSearchParams({ folder: folderPath });
      const body = await request(client, {
        ...call(`/api/recovery-drafts?${query}`, signal),
        schema: recoveryDraftListResponseSchema,
      });
      if (!body.available) return body;
      return { available: true, drafts: body.drafts.map((draft) => summary(folderPath, draft)) };
    },
    async read(source, signal) {
      const body = await request(client, {
        ...call(`/api/recovery-drafts/content?${identityQuery(source)}`, signal),
        schema: recoveryDraftContentResponseSchema,
      });
      if (body.path !== source.path) {
        throw new RecoveryDraftError('invalid-response', MESSAGES['invalid-response']);
      }
      return { ...summary(source.folderPath, body), content: body.content };
    },
    async write(snapshot, signal) {
      const identity = recoveryDraftIdentitySchema.safeParse(snapshot.source);
      if (!identity.success) {
        throw new RecoveryDraftError('unavailable', 'The draft identity is invalid.');
      }
      const write = recoveryDraftWriteRequestSchema.safeParse({
        content: snapshot.content,
        expectedVersion: snapshot.expectedVersion,
        ...identity.data,
      });
      if (!write.success) {
        throw new RecoveryDraftError(
          'too-large',
          'This draft is too large for the recovery journal.',
        );
      }
      return request(client, {
        ...call('/api/recovery-drafts', signal, { body: write.data, method: 'PUT' }),
        schema: recoveryDraftWriteResponseSchema,
      });
    },
  };
}

/**
 * The request shape every Settings endpoint is called through.
 *
 * All of them refuse the same two ways: a 400 is the reader's own request
 * coming back and reads as an invalid request, and anything else lands on the
 * shared ladder as a capability that could not be reached. Stating that once
 * means a new Settings adapter inherits the ladder instead of restating it,
 * and the sentences stay the only thing an adapter has to choose.
 */
import { SettingsError } from '@/features/settings/application/ports';
import {
  requestOptions,
  type TransportFailure,
  type TransportOptions,
  type TransportRequest,
} from '@/platform/http/classify';

/** The server's own sentence travels as the cause as well as the message, so
 *  a ladder that publishes authored sentences can read it back. */
function invalidRequest(fallback: string) {
  return ({ response, serverMessage }: TransportFailure): SettingsError | null =>
    response.status === 400
      ? new SettingsError(
          'invalid-request',
          serverMessage ?? fallback,
          serverMessage === null ? undefined : { cause: new Error(serverMessage) },
        )
      : null;
}

export interface SettingsRequestOptions {
  /** The refusal body this endpoint publishes, when it publishes one. */
  readonly failureSchema?: TransportOptions<'invalid-request'>['failureSchema'];
  /** What a success body the schema rejects reads as. */
  readonly invalidResponse: string;
  readonly path: string;
  readonly signal: AbortSignal;
  /** What an unreachable endpoint reads as, and what a refusal that carried no
   *  sentence of its own falls back to. */
  readonly unavailable: string;
}

export function settingsRequest({
  failureSchema,
  invalidResponse,
  path,
  signal,
  unavailable,
}: SettingsRequestOptions): TransportRequest<'invalid-request'> {
  return requestOptions({
    error: SettingsError,
    failure: invalidRequest(unavailable),
    failureSchema,
    messages: { 'invalid-response': invalidResponse, unavailable },
    path,
    serverMessage: true,
    signal,
  });
}

import {
  serverHealthFailureSchema,
  serverHealthRequestSchema,
  serverHealthSuccessSchema,
  type ServerHealthRequest,
} from '../../../../shared/protocols/http/server-health';
import type { ApplicationFailure, ApplicationFailureKind } from '../../shared/domain/failure';

export interface ServerHealth {
  protocolVersion: 1;
}

export type ServerHealthResult =
  | { ok: true; value: ServerHealth }
  | { ok: false; failure: ApplicationFailure };

type HealthTransportResult =
  | { kind: 'response'; status: number; body: unknown }
  | { kind: 'invalid-response'; status: number; cause: unknown };

export type HealthTransport = (path: string, signal: AbortSignal) => Promise<HealthTransportResult>;

export type ReadServerHealth = (
  request: ServerHealthRequest,
  signal: AbortSignal,
) => Promise<ServerHealthResult>;

function failed(kind: ApplicationFailureKind, message: string, cause: unknown): ServerHealthResult {
  return { ok: false, failure: { kind, message, cause } };
}

function classifyHttpStatus(status: number): ApplicationFailureKind {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 409) return 'conflict';
  if (status === 499) return 'cancelled';
  if ([408, 425, 429, 502, 503, 504].includes(status)) return 'unavailable';
  if (status >= 500) return 'fatal';
  return 'invalid-response';
}

function transportFailure(cause: unknown, signal: AbortSignal): ServerHealthResult {
  const cancelled = signal.aborted || (cause instanceof Error && cause.name === 'AbortError');
  return cancelled
    ? failed('cancelled', 'The server health request was cancelled.', cause)
    : failed('unavailable', 'The local server could not be reached.', cause);
}

export function createServerHealthAdapter(transport: HealthTransport): ReadServerHealth {
  return async (request, signal) => {
    const parsedRequest = serverHealthRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      return failed('fatal', 'The server health request was invalid.', parsedRequest.error);
    }

    let response: HealthTransportResult;
    try {
      response = await transport('/api/health', signal);
    } catch (cause) {
      return transportFailure(cause, signal);
    }

    if (response.kind === 'invalid-response') {
      return failed('invalid-response', 'The local server returned invalid JSON.', response.cause);
    }

    if (response.status >= 200 && response.status < 300) {
      const health = serverHealthSuccessSchema.safeParse(response.body);
      if (!health.success) {
        return failed(
          'invalid-response',
          'The local server returned an incompatible health response.',
          health.error,
        );
      }
      return {
        ok: true,
        value: { protocolVersion: health.data.protocolVersion },
      };
    }

    const classifiedFailure = serverHealthFailureSchema.safeParse(response.body);
    if (classifiedFailure.success) {
      return failed(
        classifiedFailure.data.failure.kind,
        classifiedFailure.data.failure.message,
        response.body,
      );
    }

    const kind = classifyHttpStatus(response.status);
    return failed(
      kind,
      `The local server health request failed with HTTP ${response.status}.`,
      response.body,
    );
  };
}

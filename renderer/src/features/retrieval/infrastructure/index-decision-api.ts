import { IndexDecisionError, type IndexDecisionPort } from '@/features/retrieval/application/ports';
import { request, send, type TransportRequest } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  indexStatusAcknowledgementSchema,
  indexStatusFailureSchema,
  semanticIndexingDecisionRequestSchema,
} from '@/protocols/http/index-status';

/** Every decision route is a folder-explicit POST that reports its own
 *  sentence when the daemon refuses it. */
function decision(
  path: string,
  body: unknown,
  signal: AbortSignal,
  fallback: string,
): TransportRequest {
  return {
    ...(body === undefined ? {} : { body }),
    error: IndexDecisionError,
    failureSchema: indexStatusFailureSchema,
    messages: {
      'invalid-response': `${fallback} The server answered unexpectedly.`,
      unavailable: fallback,
    },
    method: 'POST',
    path,
    signal,
  };
}

export function createIndexDecisionAdapter(client: HttpClient): IndexDecisionPort {
  return {
    async decide(folderPath, choice, signal) {
      await request(client, {
        ...decision(
          '/api/semantic-indexing/decision',
          semanticIndexingDecisionRequestSchema.parse({ decision: choice, folder: folderPath }),
          signal,
          choice === 'start' ? 'AI Index could not start.' : 'AI Index could not be deferred.',
        ),
        schema: indexStatusAcknowledgementSchema,
      });
    },
    async dismissWarning(folderPath, signal) {
      await request(client, {
        ...decision(
          '/api/index-warning/dismiss',
          { folder: folderPath },
          signal,
          'The warning could not be dismissed.',
        ),
        schema: indexStatusAcknowledgementSchema,
      });
    },
    async resync(folderPath, signal) {
      const query = new URLSearchParams({ folder: folderPath });
      await send(
        client,
        decision(`/api/sync?${query}`, undefined, signal, 'Sync could not start.'),
      );
    },
  };
}

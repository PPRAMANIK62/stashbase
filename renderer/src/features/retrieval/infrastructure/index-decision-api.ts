import { IndexDecisionError, type IndexDecisionApi } from '@/features/retrieval/application/ports';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  indexStatusAcknowledgementSchema,
  indexStatusFailureSchema,
  semanticIndexingDecisionRequestSchema,
} from '@/protocols/http/index-status';

async function post(
  client: HttpClient,
  path: string,
  body: unknown,
  signal: AbortSignal,
  fallback: string,
  acknowledged: boolean,
): Promise<void> {
  let response: HttpResponse;
  try {
    response = await client.request({ body, method: 'POST', path, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new IndexDecisionError('unavailable', fallback, { cause: error });
  }
  if (response.status < 200 || response.status >= 300) {
    const failure = indexStatusFailureSchema.safeParse(response.body);
    throw new IndexDecisionError(
      'unavailable',
      fallback,
      failure.success ? { cause: new Error(failure.data.error) } : undefined,
    );
  }
  if (acknowledged && !indexStatusAcknowledgementSchema.safeParse(response.body).success) {
    throw new IndexDecisionError(
      'invalid-response',
      `${fallback} The server answered unexpectedly.`,
    );
  }
}

export function createIndexDecisionApi(client: HttpClient): IndexDecisionApi {
  return {
    decide(folderPath, decision, signal) {
      return post(
        client,
        '/api/semantic-indexing/decision',
        semanticIndexingDecisionRequestSchema.parse({ decision, folder: folderPath }),
        signal,
        decision === 'start' ? 'AI Index could not start.' : 'AI Index could not be deferred.',
        true,
      );
    },
    dismissWarning(folderPath, signal) {
      return post(
        client,
        '/api/index-warning/dismiss',
        { folder: folderPath },
        signal,
        'The warning could not be dismissed.',
        true,
      );
    },
    resync(folderPath, signal) {
      const query = new URLSearchParams({ folder: folderPath });
      return post(client, `/api/sync?${query}`, undefined, signal, 'Sync could not start.', false);
    },
  };
}

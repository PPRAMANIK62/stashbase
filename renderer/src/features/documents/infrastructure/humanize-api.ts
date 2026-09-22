/**
 * The HTTP adapter for Humanize. The host answers the whole rewrite or a
 * status, and the three statuses only this capability meets are read here:
 * a busy service, a selection past the service's limit, and a rewrite the
 * service cut short. The limit itself lives with the wire schema; this
 * adapter learns it from the 413 rather than restating the number.
 */
import {
  DocumentHumanizeError,
  type DocumentHumanizeFailureKind,
  type DocumentHumanizePort,
} from '@/features/documents/application/ports';
import { request } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import { humanizeResponseSchema } from '@/protocols/http/humanize';

const MESSAGES: Readonly<Record<DocumentHumanizeFailureKind, string>> = {
  busy: 'Humanize is busy right now.',
  'cut-off': 'The rewrite was cut off before the end.',
  'invalid-response': 'Humanize answered something StashBase could not read.',
  'scope-lost': 'That folder is no longer available in this window.',
  'too-long': 'The selection is too long to humanize.',
  unauthorized: 'This window can no longer humanize text.',
  unavailable: 'Humanize is not available right now.',
};

const OWN_STATUSES: Readonly<Record<number, DocumentHumanizeFailureKind>> = {
  413: 'too-long',
  422: 'cut-off',
  429: 'busy',
};

export function createDocumentHumanizeAdapter(client: HttpClient): DocumentHumanizePort {
  return {
    humanize(input, signal) {
      return request(client, {
        body: { text: input.text },
        error: DocumentHumanizeError,
        failure: ({ response }) => {
          const kind = OWN_STATUSES[response.status];
          return kind ? new DocumentHumanizeError(kind, MESSAGES[kind]) : null;
        },
        messages: MESSAGES,
        method: 'POST',
        path: '/api/humanize',
        schema: humanizeResponseSchema,
        signal,
      });
    },
  };
}

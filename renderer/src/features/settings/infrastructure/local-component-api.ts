import type { LocalComponentPort } from '@/features/settings/application/ports';
import { settingsRequest } from '@/features/settings/infrastructure/settings-request';
import { request } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  localComponentFailureSchema,
  localComponentStatusSchema,
} from '@/protocols/http/local-components';

export function createLocalComponentAdapter(client: HttpClient): LocalComponentPort {
  const read = async (signal: AbortSignal, retry: boolean) => {
    const wire = await request(client, {
      ...settingsRequest({
        failureSchema: localComponentFailureSchema,
        invalidResponse: 'Local component status returned an invalid response.',
        path: `/api/local-components/extractor${retry ? '/retry' : ''}`,
        signal,
        unavailable: 'Local components are unavailable.',
      }),
      ...(retry ? { method: 'POST' as const, body: {} } : {}),
      schema: localComponentStatusSchema,
    });
    return { status: wire.status, error: wire.error };
  };
  return { load: (signal) => read(signal, false), retry: (signal) => read(signal, true) };
}

import type { HttpClient } from '@/platform/http/client';
import { telemetryEventSchema, type TelemetryEvent } from '@/protocols/http/telemetry';

/** Sends only the schema's enums to the local collection owner. Errors never
 * reach the writing flow; the server owns opt-out and outbound transport. */
export function createUsageRecorder(client: HttpClient) {
  return (event: TelemetryEvent): void => {
    const parsed = telemetryEventSchema.safeParse(event);
    if (!parsed.success) return;
    void client
      .request({
        path: '/api/telemetry/events',
        method: 'POST',
        body: parsed.data,
        signal: AbortSignal.timeout(2000),
      })
      .catch(() => {});
  };
}

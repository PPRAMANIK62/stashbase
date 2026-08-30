import type express from 'express';

import {
  SERVER_HEALTH_PROTOCOL_VERSION,
  serverHealthFailureSchema,
  serverHealthSuccessSchema,
  type ServerHealthFailure,
  type ServerHealthSuccess,
} from '../../shared/protocols/http/server-health.ts';

export interface ServerHealthSource {
  appRoot: string;
  resourcesPath: string;
  pid: number;
}

export type ServerHealthRouteResponse =
  | { status: 200; body: ServerHealthSuccess }
  | { status: 500; body: ServerHealthFailure };

export function createServerHealthResponse(
  source: ServerHealthSource,
): ServerHealthRouteResponse {
  const health = serverHealthSuccessSchema.safeParse({
    app: 'stashbase',
    ok: true,
    protocolVersion: SERVER_HEALTH_PROTOCOL_VERSION,
    appRoot: source.appRoot,
    resourcesPath: source.resourcesPath,
    pid: source.pid,
  });

  if (health.success) {
    return { status: 200, body: health.data };
  }

  return {
    status: 500,
    body: serverHealthFailureSchema.parse({
      app: 'stashbase',
      ok: false,
      protocolVersion: SERVER_HEALTH_PROTOCOL_VERSION,
      failure: {
        kind: 'fatal',
        message: 'The local server could not produce a valid health response.',
        code: 'INVALID_HEALTH_PRODUCER',
      },
    }),
  };
}

export function mountHealthRoute(
  app: express.Express,
  source: ServerHealthSource,
): void {
  app.get('/api/health', (_request, response) => {
    const health = createServerHealthResponse(source);
    response.status(health.status).json(health.body);
  });
}

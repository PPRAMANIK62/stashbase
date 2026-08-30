import { z } from 'zod';

export const SERVER_HEALTH_PROTOCOL_VERSION = 1 as const;

export const protocolFailureKindSchema = z.enum([
  'unauthorized',
  'unavailable',
  'invalid-response',
  'conflict',
  'cancelled',
  'fatal',
]);

export const serverHealthRequestSchema = z.object({}).strict();

export const serverHealthSuccessSchema = z.object({
  app: z.literal('stashbase'),
  ok: z.literal(true),
  protocolVersion: z.literal(SERVER_HEALTH_PROTOCOL_VERSION),
  appRoot: z.string().min(1),
  resourcesPath: z.string().min(1),
  pid: z.number().int().positive(),
});

export const serverHealthFailureSchema = z.object({
  app: z.literal('stashbase'),
  ok: z.literal(false),
  protocolVersion: z.literal(SERVER_HEALTH_PROTOCOL_VERSION),
  failure: z.object({
    kind: protocolFailureKindSchema,
    message: z.string().min(1),
    code: z.string().min(1).optional(),
  }),
});

export const serverHealthResponseSchema = z.discriminatedUnion('ok', [
  serverHealthSuccessSchema,
  serverHealthFailureSchema,
]);

export type ProtocolFailureKind = z.infer<typeof protocolFailureKindSchema>;
export type ServerHealthRequest = z.infer<typeof serverHealthRequestSchema>;
export type ServerHealthSuccess = z.infer<typeof serverHealthSuccessSchema>;
export type ServerHealthFailure = z.infer<typeof serverHealthFailureSchema>;
export type ServerHealthResponse = z.infer<typeof serverHealthResponseSchema>;

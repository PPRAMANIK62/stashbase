import { z } from 'zod';

const runtime = z.enum(['stashbase', 'claude', 'codex']);
const outcome = z.enum(['success', 'failed', 'cancelled', 'blocked']);

/** Strict, content-free allowlist. Neither arbitrary properties nor identifiers
 * from projects, documents, accounts, or native sessions can cross this boundary. */
export const telemetryEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('app_opened') }).strict(),
  z.object({ event: z.literal('project_entry_result'), outcome }).strict(),
  z.object({ event: z.literal('agent_turn_started'), runtime }).strict(),
  z.object({
    event: z.literal('agent_turn_finished'), runtime, outcome,
    duration: z.enum(['under_10s', '10s_to_60s', '1m_to_5m', 'over_5m']),
  }).strict(),
  z.object({ event: z.literal('document_write_result'), outcome: z.enum(['success', 'failed', 'conflict']) }).strict(),
  z.object({ event: z.literal('agent_setup_result'), runtime, stage: z.enum(['prepare', 'login', 'update']), outcome }).strict(),
]);
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
export const telemetryPreferencesSchema = z.object({
  enabled: z.boolean(), available: z.boolean(),
}).strip();
export const telemetryPreferencesRequestSchema = z.object({
  enabled: z.boolean(),
}).strict();
export const telemetryFailureSchema = z.object({ error: z.string() }).passthrough();

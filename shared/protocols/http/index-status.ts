import { z } from 'zod';

const folderPathSchema = z.string().trim().min(1).max(4096);
const relativePathSchema = z.string().trim().min(1).max(4096);
const countSchema = z.number().int().nonnegative();
const laneSchema = z.enum(['light', 'heavy']);

export const conversionProgressSchema = z.discriminatedUnion('phase', [
  z.object({ lane: laneSchema, phase: z.literal('queued'), tasksAhead: countSchema }).strict(),
  z.object({ lane: laneSchema, phase: z.literal('yielded'), tasksAhead: countSchema }).strict(),
  z
    .object({
      completedUnits: countSchema.optional(),
      currentPage: z.number().int().positive().optional(),
      phase: z.literal('extracting'),
      totalUnits: countSchema.optional(),
    })
    .strict(),
  z.object({ phase: z.literal('indexing') }).strict(),
]);

export const preparationFailureSchema = z
  .object({
    attempts: countSchema,
    lastError: z.string().max(4096),
    path: relativePathSchema,
    status: z.enum(['failed', 'cancelled']),
  })
  .strict();

export const semanticIndexingStateSchema = z.enum([
  'disabled',
  'quota-exhausted',
  'partial-quota-exhausted',
  'awaiting-decision',
  'paused',
  'partial-paused',
  'indexing',
  'partial-indexing',
  'ready',
  'failed',
]);

export const semanticIndexingStatusSchema = z
  .object({
    estimatedBytes: countSchema.optional(),
    sourceCount: countSchema.optional(),
    state: semanticIndexingStateSchema,
  })
  .strict();

export const indexWarningSchema = z
  .object({ at: z.string().min(1).max(64), message: z.string().max(4096) })
  .strict();

/** `GET /api/index-status?folder=` — the folder-scoped preparation and AI
 *  Index snapshot. Unknown extra fields are tolerated so a server that adds
 *  display-only counters does not invalidate an older renderer. */
export const indexStatusResponseSchema = z
  .object({
    blockedConversions: z.array(relativePathSchema).max(100_000),
    conversionProgress: z.record(relativePathSchema, conversionProgressSchema),
    conversionRevision: countSchema,
    conversionVersions: z.record(relativePathSchema, countSchema),
    folder: folderPathSchema,
    indexReady: z.boolean().default(false),
    indexWarning: indexWarningSchema.nullable().default(null),
    indexed: countSchema,
    orphaned: z.array(z.string()).max(100_000),
    orphanedCount: countSchema,
    pending: z.array(relativePathSchema).max(100_000),
    pendingConversions: z.array(relativePathSchema).max(100_000),
    pendingCount: countSchema,
    preparationFailures: z.array(preparationFailureSchema).max(100_000),
    semanticAvailable: z.boolean(),
    semanticDisabledReason: z.string().max(500).optional(),
    semanticEnabled: z.boolean(),
    semanticIndexing: semanticIndexingStatusSchema,
    total: countSchema,
    treeVersion: countSchema,
    upToDate: z.boolean(),
    visibleIndexingSettled: z.boolean(),
  })
  .passthrough();

export const indexStatusFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(500),
  })
  .passthrough();

export const semanticIndexingDecisionRequestSchema = z
  .object({
    decision: z.enum(['start', 'defer']),
    folder: folderPathSchema.optional(),
  })
  .strict();

export const indexStatusAcknowledgementSchema = z.object({ ok: z.literal(true) }).passthrough();

/** `POST /api/sync?folder=` — the folder-explicit reconcile the renderer
 *  requests after an Agent changes files. Only cancellation matters to the
 *  renderer; the change lists are display-only. */
export const folderSyncResponseSchema = z
  .object({ cancelled: z.boolean().optional() })
  .passthrough();

export type ConversionProgressWire = z.infer<typeof conversionProgressSchema>;
export type IndexStatusResponseWire = z.infer<typeof indexStatusResponseSchema>;
export type PreparationFailureWire = z.infer<typeof preparationFailureSchema>;
export type SemanticIndexingStateWire = z.infer<typeof semanticIndexingStateSchema>;
export type SemanticIndexingDecisionRequestWire = z.infer<
  typeof semanticIndexingDecisionRequestSchema
>;

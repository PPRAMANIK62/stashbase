import { z } from "zod";

const relativePathSchema = z.string().trim().min(1).max(4096);
const folderPathSchema = z.string().trim().min(1).max(4096);
const boundedMessageSchema = z.string().trim().min(1).max(500);

export const mediaRequestSchema = z
  .object({
    folderPath: folderPathSchema,
    path: relativePathSchema,
  })
  .strict();

const conversionProgressSchema = z.union([
  z
    .object({
      lane: z.enum(["light", "heavy"]),
      phase: z.enum(["queued", "yielded"]),
      tasksAhead: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      completedUnits: z.number().finite().nonnegative().optional(),
      currentPage: z.number().int().positive().optional(),
      phase: z.literal("extracting"),
      totalUnits: z.number().finite().positive().optional(),
    })
    .strict(),
  z.object({ phase: z.literal("indexing") }).strict(),
]);

const transcriptSegmentSchema = z
  .object({
    endMs: z.number().finite().nonnegative(),
    id: z.number().int().nonnegative(),
    startMs: z.number().finite().nonnegative(),
    text: z.string().max(65_536),
  })
  .strict()
  .refine((segment) => segment.endMs >= segment.startMs, {
    message: "Transcript segment end must not precede its start.",
  });

const transcriptSchema = z
  .object({
    createdAt: z.string().min(1).max(128),
    language: z.string().min(1).max(64),
    provider: z
      .object({
        id: z.string().min(1).max(128),
        model: z.string().min(1).max(128),
        version: z.string().min(1).max(128),
      })
      .strict(),
    schemaVersion: z.literal(1),
    segments: z.array(transcriptSegmentSchema).max(100_000),
    source: z
      .object({
        contentHash: z.string().regex(/^[a-f0-9]{64}$/iu),
        durationMs: z.number().finite().nonnegative(),
        mtimeMs: z.number().finite().nonnegative(),
        size: z.number().finite().nonnegative(),
        statIdentity: z.string().min(1).max(512),
      })
      .strict(),
  })
  .strict();

const blockedTranscriptSchema = z.union([
  z
    .object({
      providerId: z.string().min(1).max(128),
      reason: z.literal("provider-unavailable"),
      status: z.literal("blocked"),
    })
    .strict(),
  z
    .object({
      error: boundedMessageSchema,
      providerId: z.string().min(1).max(128),
      reason: z.literal("runtime-unavailable"),
      status: z.literal("blocked"),
    })
    .strict(),
  z
    .object({
      modelId: z.string().min(1).max(128),
      providerId: z.string().min(1).max(128),
      reason: z.enum(["model-verifying", "model-not-installed"]),
      status: z.literal("blocked"),
    })
    .strict(),
  z
    .object({
      error: boundedMessageSchema.optional(),
      modelId: z.string().min(1).max(128),
      providerId: z.string().min(1).max(128),
      reason: z.literal("model-unavailable"),
      status: z.literal("blocked"),
    })
    .strict(),
]);

export const mediaTranscriptResponseSchema = z.union([
  z.object({ status: z.literal("ready"), transcript: transcriptSchema }).strict(),
  z
    .object({ status: z.literal("pending"), progress: conversionProgressSchema.optional() })
    .strict(),
  blockedTranscriptSchema,
  z.object({ status: z.literal("cancelled") }).strict(),
  z.object({ error: boundedMessageSchema, status: z.literal("failed") }).strict(),
]);

export const mediaPreviewStatusSchema = z.union([
  z.object({ status: z.enum(["idle", "ready"]) }).strict(),
  z.object({ status: z.literal("queued"), tasksAhead: z.number().int().nonnegative() }).strict(),
  z
    .object({
      completedMs: z.number().finite().nonnegative(),
      percent: z.number().finite().min(0).max(100),
      status: z.literal("converting"),
      totalMs: z.number().finite().positive(),
    })
    .strict(),
]);

export const mediaPrepareResponseSchema = z.object({ ok: z.literal(true) }).strict();
export const mediaReprocessResponseSchema = z
  .object({ ok: z.literal(true), mode: z.enum(["conversion", "index"]).optional() })
  .strict();
export const mediaCancelResponseSchema = z
  .object({ cancelled: z.boolean(), ok: z.literal(true) })
  .strict();
export const mediaFailureSchema = z
  .object({ code: z.string().trim().min(1).max(64).optional(), error: boundedMessageSchema })
  .passthrough();

export type MediaTranscriptResponseWire = z.infer<typeof mediaTranscriptResponseSchema>;
export type MediaPreviewStatusWire = z.infer<typeof mediaPreviewStatusSchema>;

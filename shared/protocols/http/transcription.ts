import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(128);
const countSchema = z.number().int().nonnegative();

export const transcriptionModelOperationSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle') }).passthrough(),
  z.object({ status: z.literal('verifying') }).passthrough(),
  z
    .object({
      receivedBytes: countSchema,
      status: z.literal('downloading'),
      totalBytes: countSchema,
    })
    .passthrough(),
  z.object({ error: z.string().max(2000), status: z.literal('failed') }).passthrough(),
]);

export const transcriptionModelSchema = z
  .object({
    accuracy: z.string().max(200).optional(),
    available: z.boolean(),
    id: idSchema,
    label: z.string().min(1).max(200),
    management: z.enum(['local-download', 'provider']),
    operation: transcriptionModelOperationSchema.optional(),
    resourceUse: z.string().max(200).optional(),
    sizeBytes: countSchema.optional(),
    speed: z.string().max(200).optional(),
  })
  .passthrough();

export const transcriptionProviderSchema = z
  .object({
    description: z.string().max(2000),
    id: idSchema,
    kind: z.enum(['local', 'remote']),
    label: z.string().min(1).max(200),
    models: z.array(transcriptionModelSchema).max(64),
    runtimeError: z.string().max(2000).optional(),
  })
  .passthrough();

/** `GET /api/transcription/settings`. */
export const transcriptionSettingsSchema = z
  .object({
    language: z.string().min(1).max(32),
    modelId: idSchema,
    providerId: idSchema,
    providers: z.array(transcriptionProviderSchema).max(32),
  })
  .passthrough();

/** `PUT /api/transcription/preferences`; the server requires a model when the provider changes. */
export const transcriptionPreferencesRequestSchema = z
  .object({
    language: z.string().trim().min(1).max(32).optional(),
    modelId: idSchema.optional(),
    providerId: idSchema.optional(),
  })
  .strict();

export const transcriptionPreferencesResponseSchema = z
  .object({
    language: z.string().min(1).max(32),
    modelId: idSchema,
    providerId: idSchema,
  })
  .passthrough();

/** `POST /api/transcription/models/:id/download` answers 202 while downloading. */
export const transcriptionModelDownloadResponseSchema = z
  .object({
    download: transcriptionModelOperationSchema,
    id: idSchema,
  })
  .passthrough();

export const transcriptionAcknowledgementSchema = z.object({ ok: z.literal(true) }).passthrough();

export const transcriptionFailureSchema = z
  .object({ error: z.string().trim().min(1).max(500) })
  .passthrough();

export type TranscriptionSettingsWire = z.infer<typeof transcriptionSettingsSchema>;
export type TranscriptionModelWire = z.infer<typeof transcriptionModelSchema>;
export type TranscriptionProviderWire = z.infer<typeof transcriptionProviderSchema>;
export type TranscriptionModelOperationWire = z.infer<typeof transcriptionModelOperationSchema>;
export type TranscriptionPreferencesRequestWire = z.infer<
  typeof transcriptionPreferencesRequestSchema
>;

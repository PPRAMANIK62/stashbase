import { z } from 'zod';

export const localComponentStatusSchema = z.object({
  status: z.enum(['not-installed', 'downloading', 'installed', 'failed']),
  error: z.enum(['network', 'verification', 'installation', 'manifest', 'interrupted']).nullable(),
}).strict();
export type LocalComponentStatusWire = z.infer<typeof localComponentStatusSchema>;
export const localComponentRetryRequestSchema = z.object({}).strict();
export const localComponentFailureSchema = z.object({ error: z.string() });

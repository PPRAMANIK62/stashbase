import { z } from 'zod';

export const RENDERER_SERVER_ORIGIN_ARGUMENT = '--stashbase-server-origin=';

export const rendererServerOriginSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'server origin must be an uncredentialed IPv4 loopback HTTP origin',
    });
  }
});

export const rendererRuntimeConfigSchema = z
  .object({
    serverOrigin: rendererServerOriginSchema,
  })
  .strict();

export type RendererRuntimeConfig = z.infer<typeof rendererRuntimeConfigSchema>;

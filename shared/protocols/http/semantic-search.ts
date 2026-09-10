import { z } from 'zod';

const folderPathSchema = z.string().trim().min(1).max(4096);
const relativePathSchema = z.string().trim().min(1).max(4096);

/** `POST /api/library/search` in `semantic` mode. `folder` narrows to one
 *  member; omitted means the whole library. */
export const semanticSearchRequestSchema = z
  .object({
    folder: folderPathSchema.optional(),
    mode: z.literal('semantic'),
    path_prefix: z.string().trim().min(1).max(4096).optional(),
    query: z.string().trim().min(1).max(4096),
    top_k: z.number().int().min(1).max(100),
  })
  .strict();

/** One chunk of evidence, already remapped to its visible source. `folder`
 *  and `path` are the stable identity; `fileName` remains for MCP callers. */
export const semanticHitSchema = z
  .object({
    chunkIndex: z.number().int().nonnegative(),
    content: z.string().max(65_536),
    endLine: z.number().int().positive().optional(),
    fileName: z.string().min(1).max(4096),
    folder: folderPathSchema,
    heading: z.string().max(4096),
    path: relativePathSchema,
    pdfPage: z.number().int().positive().optional(),
    score: z.number().finite(),
    startLine: z.number().int().positive().optional(),
  })
  .passthrough();

export const semanticSearchResponseSchema = z
  .object({
    hits: z.array(semanticHitSchema).max(1000),
    truncated: z.boolean().optional(),
  })
  .passthrough();

export const SEMANTIC_SEARCH_FAILURE_CODES = ['HOSTED_QUOTA_EXHAUSTED', 'EMBEDDER_KEY_REQUIRED'] as const;

export const semanticSearchFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(500),
  })
  .passthrough();

export const semanticIndexingDecisionResponseSchema = z.object({ ok: z.literal(true) }).passthrough();

export type SemanticSearchRequestWire = z.infer<typeof semanticSearchRequestSchema>;
export type SemanticHitWire = z.infer<typeof semanticHitSchema>;
export type SemanticSearchResponseWire = z.infer<typeof semanticSearchResponseSchema>;

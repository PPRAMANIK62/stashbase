import { z } from 'zod';

const relativePathSchema = z.string().trim().min(1).max(4096);
const folderPathSchema = z.string().trim().min(1).max(4096);
const sourceVersionSchema = z.string().trim().min(1).max(256);
const boundedSourceTextSchema = z.string().max(8 * 1024 * 1024);

export const viewerFormatSchema = z.enum([
  'md',
  'html',
  'json',
  'txt',
  'pdf',
  'image',
  'docx',
  'audio',
  'generic',
]);

export const workspaceFileSchema = z
  .object({
    availability: z.enum(['available', 'unreadable']).optional(),
    entryKind: z.enum(['regular', 'symlink', 'special', 'cloud-placeholder']).optional(),
    format: viewerFormatSchema,
    heading: z.string().max(16_384),
    imported_at: z.string().max(64),
    name: relativePathSchema,
    size: z.number().finite().nonnegative(),
    snippet: z.string().max(16_384),
  })
  .strict();

export const workspaceFolderSchema = z
  .object({
    kind: z.enum(['normal', 'excluded', 'unreadable']).optional(),
    path: relativePathSchema,
  })
  .strict();

export const workspaceFilesSchema = z
  .object({
    files: z.array(workspaceFileSchema),
    folder: z.string().trim().min(1).max(255),
    folders: z.array(workspaceFolderSchema),
  })
  .strict();

export const workspaceFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(500),
  })
  .passthrough();

export const workspaceRevealResponseSchema = z.object({}).strict();

export const documentTextSourceRequestSchema = z
  .object({
    folderPath: folderPathSchema,
    path: relativePathSchema,
  })
  .strict();

const documentTextSourceBaseSchema = {
  content: boundedSourceTextSchema,
  format: z.enum(['md', 'html', 'json', 'txt']),
  name: relativePathSchema,
  version: sourceVersionSchema,
};

export const documentTextSourceResponseSchema = z.union([
  z.object(documentTextSourceBaseSchema).strict(),
  z
    .object({
      ...documentTextSourceBaseSchema,
      content: z.literal(''),
      format: z.literal('txt'),
      error: z
        .object({
          code: z.literal('UNSUPPORTED_ENCODING'),
          message: z.string().trim().min(1).max(500),
        })
        .strict(),
    })
    .strict(),
]);

export const documentTextSourceFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(500),
  })
  .strict();

export const documentTextSaveRequestSchema = z
  .object({
    baseVersion: sourceVersionSchema,
    content: boundedSourceTextSchema,
    folderPath: folderPathSchema,
    path: relativePathSchema,
  })
  .strict();

export const documentTextOverwriteRequestSchema = z
  .object({
    content: boundedSourceTextSchema,
    folderPath: folderPathSchema,
    overwrite: z.literal(true),
    path: relativePathSchema,
  })
  .strict();

export const documentTextSaveResponseSchema = z
  .object({
    content: boundedSourceTextSchema,
    format: z.enum(['json', 'md', 'txt']),
    indexWarning: z.string().trim().min(1).max(1_000).optional(),
    name: relativePathSchema,
    version: sourceVersionSchema,
  })
  .strict();

export const documentTextSaveFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    currentVersion: sourceVersionSchema.nullable().optional(),
    error: z.string().trim().min(1).max(500),
  })
  .strict();

export type WorkspaceFilesWire = z.infer<typeof workspaceFilesSchema>;
export type DocumentTextSourceRequestWire = z.infer<typeof documentTextSourceRequestSchema>;
export type DocumentTextSourceResponseWire = z.infer<typeof documentTextSourceResponseSchema>;
export type DocumentTextSaveRequestWire = z.infer<typeof documentTextSaveRequestSchema>;
export type DocumentTextOverwriteRequestWire = z.infer<typeof documentTextOverwriteRequestSchema>;
export type DocumentTextSaveResponseWire = z.infer<typeof documentTextSaveResponseSchema>;

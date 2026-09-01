import { z } from 'zod';

const relativePathSchema = z.string().trim().min(1).max(4096);

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

export type WorkspaceFilesWire = z.infer<typeof workspaceFilesSchema>;

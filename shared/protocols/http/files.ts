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
    /** The visibility the server actually applied. Echoed so every window's
     * menu tracks server truth rather than its own optimistic toggle. An
     * explicit member listing is Agent-facing and always reports false. */
    showHiddenFiles: z.boolean(),
  })
  .strict();

export const workspaceFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(500),
  })
  .passthrough();

export const workspaceRevealResponseSchema = z.object({}).strict();

export const workspaceRevealRequestSchema = z
  .object({
    folderPath: folderPathSchema,
    path: relativePathSchema,
  })
  .strict();

/** One leaf name: no separators, no traversal, and something left once
 *  trimmed. Whether the server keeps or completes an extension is the
 *  server's rule; the wire only rules out names that could leave the parent. */
export const workspaceEntryNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((name) => !/[\\/]/u.test(name) && name !== '.' && name !== '..', {
    message: 'entry names cannot contain separators',
  });

export const workspaceEntryKindSchema = z.enum(['file', 'folder']);

/** Identity of one file or folder inside an explicit member folder. */
export const workspaceEntryRequestSchema = z
  .object({
    folderPath: folderPathSchema,
    kind: workspaceEntryKindSchema,
    path: relativePathSchema,
  })
  .strict();

export const workspaceCreateEntryRequestSchema = z
  .object({
    folderPath: folderPathSchema,
    kind: workspaceEntryKindSchema,
    name: workspaceEntryNameSchema,
    /** Folder-relative parent; empty for the folder root. */
    parentPath: z.string().trim().max(4096),
  })
  .strict();

export const workspaceRenameEntryRequestSchema = z
  .object({
    folderPath: folderPathSchema,
    kind: workspaceEntryKindSchema,
    name: workspaceEntryNameSchema,
    path: relativePathSchema,
  })
  .strict();

/** The created or renamed entry's settled folder-relative path. File
 *  routes answer with `name`, folder routes with `path`; both may carry
 *  extra detail such as an index warning. */
export const workspaceEntryPathResponseSchema = z
  .object({ name: relativePathSchema.optional(), path: relativePathSchema.optional() })
  .passthrough()
  .refine((body) => body.name !== undefined || body.path !== undefined, {
    message: 'name or path required',
  });

export const workspaceDeleteEntryResponseSchema = z
  .object({ alreadyGone: z.boolean().optional() })
  .passthrough();

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

const genericFilePreviewBaseSchema = {
  name: relativePathSchema,
  size: z.number().finite().nonnegative().optional(),
};

export const genericFilePreviewResponseSchema = z.union([
  z
    .object({
      ...genericFilePreviewBaseSchema,
      content: boundedSourceTextSchema,
      kind: z.literal('text'),
      size: z.number().finite().nonnegative(),
      version: sourceVersionSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...genericFilePreviewBaseSchema,
      kind: z.enum([
        'binary',
        'too-large',
        'unreadable',
        'symlink',
        'special',
        'cloud-placeholder',
      ]),
      message: z.string().trim().min(1).max(500).optional(),
    })
    .strict(),
]);

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
export type WorkspaceRevealRequestWire = z.infer<typeof workspaceRevealRequestSchema>;
export type WorkspaceEntryKindWire = z.infer<typeof workspaceEntryKindSchema>;
export type WorkspaceEntryRequestWire = z.infer<typeof workspaceEntryRequestSchema>;
export type WorkspaceCreateEntryRequestWire = z.infer<typeof workspaceCreateEntryRequestSchema>;
export type WorkspaceRenameEntryRequestWire = z.infer<typeof workspaceRenameEntryRequestSchema>;
export type WorkspaceEntryPathResponseWire = z.infer<typeof workspaceEntryPathResponseSchema>;
export type DocumentTextSourceRequestWire = z.infer<typeof documentTextSourceRequestSchema>;
export type DocumentTextSourceResponseWire = z.infer<typeof documentTextSourceResponseSchema>;
export type GenericFilePreviewResponseWire = z.infer<typeof genericFilePreviewResponseSchema>;
export type DocumentTextSaveRequestWire = z.infer<typeof documentTextSaveRequestSchema>;
export type DocumentTextOverwriteRequestWire = z.infer<typeof documentTextOverwriteRequestSchema>;
export type DocumentTextSaveResponseWire = z.infer<typeof documentTextSaveResponseSchema>;

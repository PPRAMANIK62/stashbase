import { z } from 'zod';

const folderPathSchema = z.string().trim().min(1).max(4096);
const folderNameSchema = z.string().trim().min(1).max(255);

export const libraryMemberSchema = z.object({
  favorite: z.boolean().optional(),
  openedAt: z.string().trim().min(1).max(64),
  path: folderPathSchema,
});

export const activeLibraryFolderSchema = z.object({
  name: folderNameSchema,
  path: folderPathSchema,
});

export const librarySnapshotSchema = z.object({
  current: activeLibraryFolderSchema.nullable(),
  homeDir: folderPathSchema,
  recent: z.array(libraryMemberSchema).max(1000),
});

export const libraryOpenFolderRequestSchema = z
  .object({
    path: folderPathSchema,
  })
  .strict();

export const libraryFailureSchema = z.object({
  code: z.string().trim().min(1).max(64).optional(),
  error: z.string().trim().min(1).max(500),
});

export type LibrarySnapshotWire = z.infer<typeof librarySnapshotSchema>;
export type LibraryOpenFolderRequestWire = z.infer<typeof libraryOpenFolderRequestSchema>;
export type LibraryFailureWire = z.infer<typeof libraryFailureSchema>;

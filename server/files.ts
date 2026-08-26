/**
 * Stable active-folder filesystem facade.
 *
 * Public functions accept a folder-relative POSIX path like `topic/note.md`.
 * The implementation is split by responsibility so path containment, on-disk
 * mutations, and sidebar listing stay independently navigable while existing
 * route and library imports continue to use this module.
 */

export { detectFormat, type FileFormat } from './format.ts';
export {
  getCurrentFolderBasename,
  isSameExistingPath,
  sanitizeFilename,
} from './file-paths.ts';
export {
  createFolder,
  createTextExclusive,
  deleteFile,
  deleteFolder,
  derivedArtifactsForSource,
  fileStatVersion,
  fileVersion,
  MAX_TEXT_READ_BYTES,
  pathExists,
  readText,
  readUtf8FileBounded,
  renameFolder,
  renameOnDisk,
  resolveAsset,
  resolveExisting,
  saveBytes,
  saveText,
  type DerivedArtifacts,
} from './active-file-operations.ts';
export {
  HIDDEN_DOT_FILES,
  listFiles,
  listFilesAndFolders,
  listFilesAndFoldersAsync,
  listFolders,
  listImmediateDirectory,
  listIndexableTextFilesUnder,
  type FileEntry,
  type FolderEntry,
  type FolderListing,
  type ImmediateDirectoryEntry,
} from './file-listing.ts';

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
  isSameExistingPathAsync,
  resolveSafeAsync,
  sanitizeFilename,
} from './file-paths.ts';
export {
  createFolder,
  createFolderAsync,
  createTextExclusive,
  createTextExclusiveAsync,
  deleteFile,
  deleteFileAsync,
  deleteFolder,
  deleteFolderAsync,
  derivedArtifactsForSource,
  fileStatVersion,
  fileStatVersionAsync,
  fileVersion,
  fileVersionAsync,
  MAX_TEXT_READ_BYTES,
  pathExists,
  pathExistsAsync,
  readText,
  readTextAsync,
  readUtf8FileBounded,
  readUtf8FileBoundedAsync,
  renameFolder,
  renameFolderAsync,
  renameOnDisk,
  renameOnDiskAsync,
  resolveAsset,
  resolveAssetAsync,
  resolveExisting,
  resolveExistingAsync,
  saveBytes,
  saveBytesAsync,
  saveText,
  saveTextAsync,
  type DerivedArtifacts,
} from './active-file-operations.ts';
export {
  HIDDEN_DOT_FILES,
  listFiles,
  listFilesAsync,
  listFilesAndFolders,
  listFilesAndFoldersAsync,
  listFolders,
  listImmediateDirectory,
  listImmediateDirectoryAsync,
  listIndexableTextFilesUnder,
  listIndexableTextFilesUnderAsync,
  type FileEntry,
  type FolderEntry,
  type FolderListing,
  type ImmediateDirectoryEntry,
} from './file-listing.ts';

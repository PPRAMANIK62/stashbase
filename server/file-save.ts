import { getApiKey } from './app-config.ts';
import { normalizeFolderRelativePath } from './folder-relative-path.ts';
import { toSourcePath } from './folder.ts';
import { detectFormat, isDerivedNoteName } from './format.ts';
import { fileVersion, readEditableText, readText, saveEditableText, saveText } from './files.ts';
import { contentSizeError } from './indexable.ts';
import { errorMessage, logger } from './log.ts';
import { indexer } from './state.ts';
import { noteTreeChanged } from './watcher.ts';

const log = logger('file-save');

function fileWriteError(message: string, status = 400, code = 'INVALID_FILE_WRITE'): Error {
  const err = new Error(message);
  (err as any).status = status;
  (err as any).code = code;
  return err;
}

export function validateEditableFileWrite(name: string): void {
  let normalized: string;
  try {
    normalized = normalizeFolderRelativePath(name, { writable: true, allowQuotes: true });
  } catch (err: unknown) {
    throw fileWriteError(errorMessage(err));
  }
  if (isDerivedNoteName(normalized)) {
    throw fileWriteError('cannot edit app-maintained derived notes');
  }
  if (!detectFormat(normalized)) {
    throw fileWriteError('unsupported editable format', 415, 'UNSUPPORTED_FORMAT');
  }
}

export async function upsertSavedFile(name: string, content: string): Promise<string | undefined> {
  if (!getApiKey()) {
    log.info(`save: skipped index update for ${name} because no OpenAI key is configured`);
    return undefined;
  }
  if (!content.trim()) {
    await indexer.deleteFile(toSourcePath(name)).catch((err) => {
      log.warn(`save: failed to remove empty file from index ${name}: ${errorMessage(err)}`);
    });
    return undefined;
  }
  const tooLarge = contentSizeError(content);
  if (tooLarge) {
    await indexer.deleteFile(toSourcePath(name)).catch((err) => {
      log.warn(`save: failed to remove oversized file from index ${name}: ${errorMessage(err)}`);
    });
    log.warn(`save: skipped index update for ${name}: ${tooLarge}`);
    return `${tooLarge}. Semantic search will skip it until you split or reduce it and run sync.`;
  }
  try {
    await indexer.upsertFile(toSourcePath(name), content);
    return undefined;
  } catch (err: unknown) {
    const message = errorMessage(err);
    log.warn(`save: index update failed for ${name}: ${message}`);
    return `Saved, but semantic index update failed: ${message}`;
  }
}

export async function saveFileContent(
  name: string,
  content: string,
  opts: { baseVersion?: string } = {},
): Promise<{ indexWarning?: string; version?: string }> {
  validateEditableFileWrite(name);
  const preservesMarkdownSourceFormat = detectFormat(name) === 'md';
  const currentEditableContent = () => (preservesMarkdownSourceFormat ? readEditableText(name) : readText(name));
  if (opts.baseVersion !== undefined) {
    const currentVersion = fileVersion(name);
    if (currentVersion !== opts.baseVersion) {
      if (currentEditableContent() === content) {
        return { version: currentVersion ?? undefined };
      }
      const err = new Error('file changed on disk; reload before saving');
      (err as any).code = 'FILE_CHANGED';
      (err as any).currentVersion = currentVersion;
      throw err;
    }
  }
  // A caller can legitimately submit the canonical editor text during an
  // autosave or view transition. Never turn that no-op into an atomic replace
  // of the source bytes merely because the source uses a BOM or CRLF.
  if (currentEditableContent() === content) {
    return { version: fileVersion(name) ?? undefined };
  }
  if (preservesMarkdownSourceFormat) saveEditableText(name, content);
  else saveText(name, content);
  // Index the serialized source, not the editor's canonical presentation.
  // This keeps indexing on the same source-of-truth bytes that the user
  // asked us to preserve.
  const savedContent = readText(name) ?? content;
  const indexWarning = await upsertSavedFile(name, savedContent);
  noteTreeChanged();
  return { indexWarning, version: fileVersion(name) ?? undefined };
}

import fs from 'node:fs';
import path from 'node:path';
import { derivedNoteFor, sourceForDerivedText } from './derived-store.ts';
import { memberRootForAbsAsync, runWithFolderRoot } from './folder.ts';
import { filesystemPath } from './filesystem-path.ts';
import { detectFormat, detectViewerFormat } from './format.ts';
import {
  fileStatVersionAsync,
  fileVersionAsync,
  pathExistsAsync,
  readTextAsync,
  readUtf8FileBoundedAsync,
} from './files.ts';
import { isConversionTextUnavailable } from './conversion.ts';
import { isAudioTranscriptTextUnavailable } from './audio-transcription.ts';
import { derivedHtmlPathForDocx } from './docx.ts';
import {
  normalizeLibraryFilePath,
  resolveLibraryAbs,
  routeError,
  type AgentContextFile,
} from './library-file-access.ts';

export interface LibraryFileRead {
  path: string;
  format: string;
  content: string;
  version?: string;
  sourceFormat?: string;
  readPath?: string;
  derived?: boolean;
  /** Present only when `content` is a line window rather than the whole file. */
  partial?: true;
  totalLines?: number;
  /** Offset to pass back for the next window; absent once the window ends the file. */
  nextOffset?: number;
}

/** A 1-based line window over an already-read file. */
export interface LibraryFileLineRange {
  offset?: number;
  limit?: number;
}

/** Parse one optional public read-window bound. HTTP query parameters arrive
 * as strings while MCP arguments arrive as numbers; both transports must
 * reject malformed supplied values instead of silently widening to a whole
 * file read. */
export function parseLibraryFileLineBound(raw: unknown, name: 'offset' | 'limit'): number | undefined {
  if (raw === undefined) return undefined;
  if ((typeof raw !== 'string' && typeof raw !== 'number') || (typeof raw === 'string' && !raw.trim())) {
    throw routeError(`${name} must be a positive integer`, 400);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw routeError(`${name} must be a positive integer`, 400);
  }
  return value;
}

export function isAgentReadableDerivedTextReady(
  sourceAbs: string,
  sourceFormat: 'pdf' | 'docx' | 'audio',
): boolean {
  if (isConversionTextUnavailable(sourceAbs) || isAudioTranscriptTextUnavailable(sourceAbs)) return false;
  const derivedAbs = sourceFormat === 'docx'
    ? derivedHtmlPathForDocx(sourceAbs)
    : derivedNoteFor(sourceAbs);
  return fs.existsSync(derivedAbs);
}

export async function agentContextFile(rawPath: unknown): Promise<AgentContextFile> {
  const target = await normalizeLibraryFilePath(rawPath);
  const folderName = path.basename(target.folderRoot);
  return runWithFolderRoot(target.folderRoot, async () => {
    const sourceFormat = detectViewerFormat(target.folderRel);
    if (!sourceFormat) throw routeError('unsupported format', 415, 'UNSUPPORTED_FORMAT');
    if (!(await pathExistsAsync(target.folderRel))) throw routeError('not found', 404);

    if (sourceFormat !== 'pdf' && sourceFormat !== 'docx' && sourceFormat !== 'audio') {
      return {
        path: target.abs,
        folder: folderName,
        sourcePath: target.folderRel,
        readPath: target.folderRel,
        kind: 'direct',
        sourceFormat,
        available: true,
        reason: sourceFormat === 'image'
          ? 'Images are read as the source image; OCR text is used for search indexing.'
          : 'Structured text files are the readable source.',
      };
    }

    // Derived text lives in per-machine app data, so the built-in agent gets
    // an absolute read path while the visible source remains the identity.
    const derivedAbs = sourceFormat === 'docx'
      ? derivedHtmlPathForDocx(target.abs)
      : derivedNoteFor(target.abs);
    if (isConversionTextUnavailable(target.abs) || isAudioTranscriptTextUnavailable(target.abs)) {
      return {
        path: target.abs,
        folder: folderName,
        sourcePath: target.folderRel,
        readPath: target.folderRel,
        kind: 'direct',
        sourceFormat,
        available: false,
        reason: 'Searchable text is pending or preparation failed; retry after completion or reprocess the source.',
      };
    }
    try {
      await fs.promises.access(derivedAbs);
    } catch {
      return {
        path: target.abs,
        folder: folderName,
        sourcePath: target.folderRel,
        readPath: target.folderRel,
        kind: 'direct',
        sourceFormat,
        available: false,
        reason: sourceFormat === 'docx'
          ? 'No extracted HTML exists yet for this DOCX; retry after conversion if you need text context.'
          : sourceFormat === 'audio'
            ? 'No transcript exists yet for this media file; install the selected local model or retry after transcription.'
            : 'No extracted Markdown exists yet for this PDF; retry after conversion if you need text context.',
      };
    }

    return {
      path: target.abs,
      folder: folderName,
      sourcePath: target.folderRel,
      readPath: derivedAbs,
      kind: 'derived',
      sourceFormat,
      available: true,
      reason: sourceFormat === 'docx'
        ? 'Read the extracted HTML file (an absolute app-data path) first for this DOCX; the original DOCX stays as the source identity.'
        : sourceFormat === 'audio'
          ? 'Read the timestamped transcript Markdown (an absolute app-data path) first; the original audio stays as the source identity.'
          : 'Read the extracted Markdown note (an absolute app-data path) first for this PDF; use the original only when raw visual or binary detail is needed.',
    };
  });
}

export async function readLibraryFile(
  rawPath: unknown,
  range?: LibraryFileLineRange,
): Promise<LibraryFileRead> {
  return applyLineRange(await readWholeLibraryFile(rawPath), range);
}

/** Narrow an already-read file to a 1-based line window. Reading stays whole-file
 * and bounded by MAX_TEXT_READ_BYTES; this only bounds what the caller receives.
 * Because the slice happens after that bounded read, a source above the ceiling
 * stays unreadable in every window. Serving those would mean streaming the window
 * off disk, which costs TXT its whole-file UTF-8 validation. */
export function applyLineRange(
  read: LibraryFileRead,
  range?: LibraryFileLineRange,
): LibraryFileRead {
  if (range == null) return read;
  const offset = Math.max(1, Math.trunc(range?.offset ?? 1));
  const limit = range?.limit == null ? null : Math.max(0, Math.trunc(range.limit));

  const lines = read.content.split('\n');
  const endsWithNewline = lines.length > 1 && lines[lines.length - 1] === '';
  if (endsWithNewline) lines.pop();
  const totalLines = lines.length;

  const start = Math.min(offset - 1, totalLines);
  const end = limit == null ? totalLines : Math.min(start + limit, totalLines);
  const window = lines.slice(start, end);
  const content = window.length === 0
    ? ''
    : window.join('\n') + (end < totalLines || endsWithNewline ? '\n' : '');

  // A window must never be mistaken for the whole file: without the version
  // token it cannot be laundered into an optimistic full-file overwrite.
  const { version: _version, ...rest } = read;
  return {
    ...rest,
    content,
    partial: true,
    totalLines,
    ...(end < totalLines ? { nextOffset: end + 1 } : {}),
  };
}

async function readWholeLibraryFile(rawPath: unknown): Promise<LibraryFileRead> {
  const derived = await normalizeDerivedReadPath(rawPath);
  if (derived) return derived;
  const target = await normalizeLibraryFilePath(rawPath);
  return runWithFolderRoot(target.folderRoot, async () => {
    const format = detectFormat(target.folderRel);
    if (!format) {
      const viewerFormat = detectViewerFormat(target.folderRel);
      if (viewerFormat === 'pdf') {
        return readSourceDerivedFile(target.abs, target.folderRel, 'pdf');
      }
      if (viewerFormat === 'docx') {
        return readSourceDerivedFile(target.abs, target.folderRel, 'docx');
      }
      if (viewerFormat === 'audio') {
        return readSourceDerivedFile(target.abs, target.folderRel, 'audio');
      }
      if (viewerFormat === 'image') {
        throw routeError('read_file cannot return image bytes; image OCR text is used for search evidence, while the image remains the source file', 415, 'UNSUPPORTED_FORMAT');
      }
      throw routeError('unsupported format', 415, 'UNSUPPORTED_FORMAT');
    }
    const content = await readTextAsync(target.folderRel);
    if (content == null) throw routeError('not found', 404);
    return {
      path: target.abs,
      format,
      content,
      version: (await fileVersionAsync(target.folderRel)) ?? undefined,
    };
  });
}

async function readSourceDerivedFile(
  sourceAbs: string,
  folderRel: string,
  sourceFormat: 'pdf' | 'docx' | 'audio',
): Promise<LibraryFileRead> {
  const label = sourceFormat === 'docx' ? 'HTML' : 'Markdown';
  if (isConversionTextUnavailable(sourceAbs) || isAudioTranscriptTextUnavailable(sourceAbs)) {
    throw routeError(`extracted ${label} is pending or preparation failed; retry after completion or reprocess the ${sourceFormat.toUpperCase()}`, 409, 'CONVERSION_NOT_READY');
  }
  const derivedAbs = sourceFormat === 'docx'
    ? derivedHtmlPathForDocx(sourceAbs)
    : derivedNoteFor(sourceAbs);
  let content: string;
  try {
    content = await readUtf8FileBoundedAsync(derivedAbs);
  } catch (err) {
    if ((err as { code?: unknown })?.code === 'FILE_TOO_LARGE') throw err;
    throw routeError(`extracted ${label} is not available for this ${sourceFormat.toUpperCase()} yet; retry conversion or run reindex first`, 409, 'CONVERSION_NOT_READY');
  }
  return {
    path: sourceAbs,
    format: sourceFormat === 'docx' ? 'docx-derived-html' : sourceFormat === 'audio' ? 'audio-transcript-md' : 'pdf-derived-md',
    sourceFormat,
    readPath: derivedAbs,
    derived: true,
    content,
    version: (await fileStatVersionAsync(folderRel)) ?? undefined,
  };
}

async function normalizeDerivedReadPath(rawPath: unknown): Promise<LibraryFileRead | null> {
  let abs: string;
  try {
    abs = resolveLibraryAbs(rawPath, { allowEmpty: false });
  } catch {
    return null;
  }
  const sourceAbs = sourceForDerivedText(abs);
  if (!sourceAbs) return null;
  const folderRoot = await memberRootForAbsAsync(sourceAbs);
  if (!folderRoot) {
    throw routeError('derived source is not in your folders (call library_info to list them)', 400);
  }
  return readDerivedLibraryFile(abs, sourceAbs, folderRoot);
}

async function readDerivedLibraryFile(
  derivedAbs: string,
  sourceAbs: string,
  folderRoot: string,
): Promise<LibraryFileRead> {
  if (isConversionTextUnavailable(sourceAbs) || isAudioTranscriptTextUnavailable(sourceAbs)) {
    throw routeError('derived text is pending or preparation failed; retry after completion or reprocess the source', 409, 'CONVERSION_NOT_READY');
  }
  const folderRel = await filesystemPath.relativeAsync(folderRoot, sourceAbs);
  if (folderRel == null || folderRel === '') {
    throw routeError('derived source path is invalid for its folder', 400);
  }
  const sourceFormat = detectViewerFormat(folderRel);
  if (sourceFormat !== 'pdf' && sourceFormat !== 'docx' && sourceFormat !== 'audio') {
    throw routeError('derived reads are only exposed for PDF/DOCX/audio text context', 403);
  }
  return runWithFolderRoot(folderRoot, async () => {
    return {
      path: sourceAbs,
      format: sourceFormat === 'docx' ? 'docx-derived-html' : sourceFormat === 'audio' ? 'audio-transcript-md' : 'pdf-derived-md',
      sourceFormat,
      readPath: derivedAbs,
      derived: true,
      content: await readDerivedText(derivedAbs, sourceFormat),
      version: (await fileStatVersionAsync(folderRel)) ?? undefined,
    };
  });
}

async function readDerivedText(derivedAbs: string, sourceFormat: 'pdf' | 'docx' | 'audio'): Promise<string> {
  try {
    return await readUtf8FileBoundedAsync(derivedAbs);
  } catch (err) {
    if ((err as { code?: unknown })?.code === 'FILE_TOO_LARGE') throw err;
    throw routeError(sourceFormat === 'docx'
      ? 'extracted HTML is not available for this DOCX yet; retry conversion or run reindex first'
      : sourceFormat === 'audio'
        ? 'transcript Markdown is not available for this media file yet; install a model or retry transcription first'
        : 'extracted Markdown is not available for this PDF yet; retry conversion or run reindex first', 409, 'CONVERSION_NOT_READY');
  }
}

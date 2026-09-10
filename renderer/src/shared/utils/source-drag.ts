import type { SourceReference } from '@/shared/domain/source-reference';

/** Drag payload for a library source moved between features, such as a
 *  file-tree row dropped on the Agent composer. Only the visible source
 *  identity travels; the receiver resolves what the Agent may read. */
export const SOURCE_DRAG_MIME = 'application/x-stashbase-source';

export function writeSourceDrag(dataTransfer: DataTransfer, source: SourceReference): void {
  dataTransfer.setData(SOURCE_DRAG_MIME, JSON.stringify(source));
  dataTransfer.effectAllowed = 'copy';
}

export function dragCarriesSource(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(SOURCE_DRAG_MIME);
}

export function readSourceDrag(dataTransfer: DataTransfer): SourceReference | null {
  const raw = dataTransfer.getData(SOURCE_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as SourceReference).folderPath === 'string' &&
      typeof (parsed as SourceReference).path === 'string' &&
      (parsed as SourceReference).folderPath.length > 0 &&
      (parsed as SourceReference).path.length > 0
    ) {
      const { folderPath, path } = parsed as SourceReference;
      return { folderPath, path };
    }
  } catch {
    // A foreign payload under our type is treated as no source.
  }
  return null;
}

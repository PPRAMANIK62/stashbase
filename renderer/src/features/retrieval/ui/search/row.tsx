import { FileTypeIcon } from '@/components/ui/file-type-icon';

function basename(path: string): string {
  return path.split(/[\\/]/u).at(-1) ?? path;
}

export function parentPath(path: string): string {
  const parts = path.split(/[\\/]/u);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

/** A result row reads as file, then where it is, then what was matched. */
export function rowLabel(path: string, ...details: readonly (string | null)[]): string {
  return [basename(path), parentPath(path), ...details]
    .filter((part): part is string => part !== null && part !== '')
    .join(', ');
}

/** The file identity every backend puts at the head of a result. */
export function SourceName({ path }: { path: string }) {
  return (
    <>
      <FileTypeIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
        path={path}
      />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{basename(path)}</span>
    </>
  );
}

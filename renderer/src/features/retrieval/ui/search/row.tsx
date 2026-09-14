import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { basePathName, parentPathOf } from '@/shared/utils/file-path';

/** A result row reads as file, then where it is, then what was matched. */
export function rowLabel(path: string, ...details: readonly (string | null)[]): string {
  return [basePathName(path), parentPathOf(path), ...details]
    .filter((part): part is string => part !== null && part !== '')
    .join(', ');
}

/** The file identity every backend puts at the head of a result. */
export function SourceName({ path }: { path: string }) {
  return (
    <>
      <FileTypeIcon aria-hidden="true" className="shrink-0 text-muted-foreground" path={path} />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {basePathName(path)}
      </span>
    </>
  );
}

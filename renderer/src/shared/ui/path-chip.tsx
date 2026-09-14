/**
 * A path shown as evidence, not as prose.
 *
 * A question about a file — delete this, forget this project — is answered on
 * the name in the sentence, but the reader confirming it wants to see exactly
 * which file that is. This block is the exact path: monospaced so separators
 * and lookalike characters are legible, wrapping at any character so a long
 * path cannot push a dialog wider than the screen, and recessive so it reads
 * as the evidence under the question rather than as part of it.
 */
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

export function PathChip({
  className,
  path,
  title,
}: {
  className?: string | undefined;
  /** The path as the reader should read it, which may be shortened — `~` for
   *  home, for instance. */
  path: string;
  /** The unabbreviated path, when what is shown is a shortened form of it.
   *  Hovering then gives the reader the whole thing. */
  title?: string | undefined;
}) {
  const shape = useShape();
  return (
    <div
      className={cn(
        'max-w-full bg-muted px-2.5 py-2 font-mono text-caption break-all text-muted-foreground',
        shape.chip,
        className,
      )}
      title={title ?? path}
    >
      {path}
    </div>
  );
}

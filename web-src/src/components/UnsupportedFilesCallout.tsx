import { useApp } from '../store/AppContext';

function formatExtensions(otherExtensions: Array<{ extension: string; count: number }>): string {
  const list = otherExtensions.map((entry) => entry.extension);
  const visible = list.slice(0, 3);
  const remaining = list.length - visible.length;
  return visible.join(', ') + (remaining > 0
    ? ` and ${remaining} more format${remaining === 1 ? '' : 's'}`
    : '');
}

/** Unsupported-file disclosure for the explorer. The eager sidebar gate
 *  loads it only when the current folder reports hidden files. */
export default function UnsupportedFilesCallout() {
  const { state, dispatch } = useApp();
  const { sourceCode = 0, other = 0, otherExtensions = [] } = state.unsupportedFiles || {};
  if (sourceCode + other === 0) return null;

  const title = sourceCode > 0 && other > 0
    ? 'Some files are hidden'
    : sourceCode > 0
      ? 'Source code is hidden'
      : 'Some file formats are hidden';
  const detail = sourceCode > 0 && other > 0
    ? `${sourceCode} source-code files · ${other} other unsupported files`
    : sourceCode > 0
      ? `${sourceCode} source-code and project files are not shown or indexed.`
      : `${other} unsupported files (${formatExtensions(otherExtensions)}) are not shown or indexed.`;

  return (
    <div className="mx-1.5 mb-2 rounded-lg border border-border bg-muted/45 px-2.5 py-2 text-xs leading-snug text-muted-foreground">
      <div className="font-semibold text-foreground">{title}</div>
      <div className="mt-0.5">
        {detail}{' '}
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent underline underline-offset-2"
          onClick={() => dispatch({ type: 'UNSUPPORTED_MODAL', open: true })}
        >Details</button>
      </div>
    </div>
  );
}

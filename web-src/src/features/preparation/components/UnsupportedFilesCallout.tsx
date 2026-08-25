import { useReducer } from 'react';
import { Button } from '@/common/components/ui/button';
import { SectionHeading } from '@/common/components/ui/section';
import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';

const DISMISS_KEY = 'stashbase.unsupported-callout-dismissed';

function formatExtensions(otherExtensions: Array<{ extension: string; count: number }>): string {
  const list = otherExtensions.map((entry) => entry.extension);
  const visible = list.slice(0, 3);
  const remaining = list.length - visible.length;
  return visible.join(', ') + (remaining > 0
    ? ` and ${remaining} more format${remaining === 1 ? '' : 's'}`
    : '');
}

/** The dismissal signature tracks what the card is ABOUT, not how much:
 *  the category set (extension list + source-code presence). More files
 *  of an already-disclosed kind stay quiet after a dismiss; a NEW kind
 *  brings the card back. */
function categorySignature(
  sourceCode: number,
  otherExtensions: Array<{ extension: string; count: number }>,
): string {
  return (sourceCode > 0 ? 'source-code|' : '')
    + otherExtensions.map((entry) => entry.extension).sort().join(',');
}

function readDismissedMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function rememberDismissed(folderPath: string, signature: string): void {
  try {
    const map = readDismissedMap();
    map[folderPath] = signature;
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    // Private browsing and hardened WebViews may reject localStorage;
    // the card then simply returns next launch.
  }
}

/** Unsupported-file disclosure for the explorer. The eager sidebar gate
 *  loads it only when the current folder reports hidden files.
 *
 *  A dismissable card: persistent low-urgency state doesn't get to camp
 *  in the sidebar forever, but until the user waves it off it presents
 *  as a proper notice. Dismissal is per folder and persisted (see
 *  `categorySignature` for when it comes back). */
export default function UnsupportedFilesCallout() {
  const state = useWorkspace();
  const { dispatch } = useAppActions();
  // Dismissal lives in localStorage, not the store — this bump just
  // forces the re-render that hides the card in place.
  const [, bumpDismissals] = useReducer((n: number) => n + 1, 0);
  const { sourceCode = 0, other = 0, otherExtensions = [] } = state.unsupportedFiles || {};
  const folderPath = state.folderPath;
  if (sourceCode + other === 0 || !folderPath) return null;

  const signature = categorySignature(sourceCode, otherExtensions);
  // Read at render time (not mounted state): the component instance can
  // survive a folder switch, and each folder has its own dismissal.
  if (readDismissedMap()[folderPath] === signature) return null;

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
    <div className="relative mx-1.5 mb-2 rounded-lg border border-border bg-muted/45 py-2 pr-7 pl-2.5 text-xs leading-snug text-muted-foreground">
      <SectionHeading className="text-xs">{title}</SectionHeading>
      <div className="mt-0.5">
        {detail}{' '}
        {/* Inline in the sentence, so `size="xs"` is taken for the type step
          * alone and the height/padding come straight back off. */}
        <Button
          variant="link"
          size="xs"
          className="h-auto cursor-pointer border-0 p-0 font-semibold text-accent underline underline-offset-2"
          onClick={() => dispatch({ type: 'UNSUPPORTED_MODAL', open: true })}
        >Details</Button>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        /* Held at 20px rather than the icon-xs 24, so it keeps the
         * sub-24px control corner (`rounded-sm`) the corner rule assigns.
         * bg-active on hover, not the ghost variant's bg-muted: nested
         * inside a surface that is already muted-tinted, so it needs the
         * one-step-darker state to read (same rule as the New Chat
         * chevron). */
        className="absolute top-1 right-1 size-5 cursor-pointer rounded-sm border-0 text-muted-foreground hover:bg-active hover:text-foreground"
        onClick={() => { rememberDismissed(folderPath, signature); bumpDismissals(); }}
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </Button>
    </div>
  );
}

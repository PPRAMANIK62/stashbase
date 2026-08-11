/**
 * Shared Tailwind class recipes for agent-panel chrome that more than one
 * agent component renders (header icon buttons, attachment chips). Content
 * typography (.agent-prose), the sticky turn-head system, and the One-Dark
 * code palette intentionally stay in styles/chat.css.
 */
import { cn } from '../../lib/utils';
import { buttonVariants } from '../ui/button';

/** Quiet 28px icon action — pane header buttons and composer bar buttons. */
export const iconGhostButtonClass = cn(
  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
  'text-muted-foreground',
);

/* Quiet pill trigger — the ONE "pick a value" trigger idiom, shared by the
 * composer's scope/model/mode pills and the search popup's scope pill so
 * "choose a scope" looks identical everywhere. Text-only label + small
 * chevron; state lives in the label, emphasis in none. */
export const pillClass =
  'inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-0.75 text-xs whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-default';
export const pillLockedClass = 'cursor-default opacity-60';
export const pillChevronClass = '-ml-px size-3 shrink-0 opacity-75';

/* The pill menus' shared row recipe (header line, icon + title + detail
 * rows, accent inset on the active row, trailing check) — the composer's
 * scope/model/mode menus and the search popup's scope menu are one
 * construction with different options. */
export const menuHeadClass = 'flex flex-col items-start gap-0.5 px-2 pt-1 pb-2 text-sm';
/* Quiet section label INSIDE a menu ("Folders", "Subfolders") — grouping
 * without a hairline: a hard separator right under the default row cuts
 * the menu in half; a muted label groups the list instead. */
export const menuSectionClass = 'px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground';
export const optClass =
  'flex w-full cursor-pointer items-start gap-2.5 rounded-md border-0 bg-transparent p-2 text-left text-foreground hover:bg-muted data-focused:bg-muted data-highlighted:bg-muted';
/* Active row = neutral selected surface + trailing accent check, two
 * signals only — accent never becomes a row-width wash (visual-style:
 * selection surfaces are quiet neutrals one step past hover; hue stays
 * on button-level elements like the check). */
export const optActiveClass =
  'bg-active hover:bg-active data-focused:bg-active data-highlighted:bg-active';
export const optIconClass = 'mt-px size-4.5 shrink-0 text-muted-foreground';
export const optTextClass = 'flex min-w-0 flex-1 flex-col gap-0.5';
export const optTitleClass = 'text-sm font-medium';
export const optDescClass = 'text-xs leading-snug text-muted-foreground';
export const optCheckClass = 'mt-0.5 size-4 shrink-0 text-accent';

/** Compact file chip shown in the composer and in sent transcript turns. */
export const attachChipClass =
  'inline-flex max-w-65 items-center gap-1 rounded-md border border-border bg-muted py-0.75 pr-1 pl-1.75 text-xs text-foreground';

/** 64px image thumbnail chip (composer removable + transcript static). */
export const attachImageChipClass =
  'relative size-16 overflow-hidden rounded-lg border border-border bg-muted shadow-low';

/** The thumbnail button/img inside an image chip. */
export const attachImagePreviewClass =
  'block h-full w-full cursor-zoom-in border-0 bg-transparent p-0 [&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:object-cover';

/** Floating × on an image chip. */
export const attachImageRemoveClass =
  'absolute top-1 right-1 grid size-4 cursor-pointer place-items-center rounded-full border border-border/80 bg-background/75 p-0 text-foreground [&_svg]:block [&_svg]:size-2.25 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:[stroke-linecap:round]';

/** Inline × on a text file chip. */
export const attachRemoveClass =
  'grid size-4 shrink-0 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-lg leading-none text-muted-foreground hover:bg-active hover:text-foreground';

export const attachIconClass = 'size-3.25 shrink-0 text-muted-foreground';

export const attachNameClass = 'overflow-hidden text-ellipsis whitespace-nowrap';

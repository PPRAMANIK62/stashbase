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

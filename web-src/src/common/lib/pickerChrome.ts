/**
 * Shared chrome for the lightweight topmost pickers — Quick Open, Link to
 * file, and the Editor History navigator. All use one restrained modal
 * palette; Editor History is just narrower and skips the input row (no
 * query, just a hold-to-cycle list).
 *
 * What is left here are the picker's LAYERS — the veil, the panel, the
 * group label, the scroller — each of which is handed to a differently
 * shaped element in each picker (a veil that also carries a per-picker
 * dismissal marker, a panel that is a dialog in three of them and a
 * width-varying box in the fourth, a `<ul>` whose id and aria wiring
 * differ per picker). A component around any of them would take a
 * className and children and forward both, which is the wrapper this
 * would be worth avoiding. The one layer where the markup itself has to
 * agree — the result row and its ARIA — IS a component: see `PickerRow`.
 */
import { cn } from '@/common/lib/utils';

export const PICKER_VEIL_CLASS =
  'fixed inset-0 z-picker flex items-start justify-center bg-veil-quiet pt-[min(18vh,150px)]';

export function pickerPanelClass(width: 'wide' | 'narrow'): string {
  return cn(
    'overflow-hidden rounded-lg border border-border bg-popover shadow-elevation',
    width === 'wide'
      ? 'w-overlay-xl max-h-overlay-md'
      : 'w-overlay-md max-h-overlay-md outline-none',
  );
}

export const PICKER_LABEL_CLASS = 'px-3.5 pt-2 pb-1 text-sm text-muted-foreground';

/* `max-h-overlay-sm`, not the `max-h-95` (380px) it replaces: an overlay
 * height is a role off the scale, and this is the inner scroller of a
 * panel already capped at `max-h-overlay-md`. It takes the step BELOW the
 * panel's so the query row above it always fits inside that cap — at the
 * panel's own step the list would push the last rows under the panel's
 * `overflow-hidden` edge, where nothing can scroll them back. It also
 * picks up the scale's `70vh` clamp, which the literal never had. */
export const PICKER_RESULTS_CLASS = 'm-0 max-h-overlay-sm list-none overflow-auto p-1.5';

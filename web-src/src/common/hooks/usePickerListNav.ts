import { useEffect, useState, type KeyboardEvent } from 'react';

/** Active-row index and keyboard navigation shared by the topmost list
 *  pickers (Quick Open, "Link to file…"): Up/Down/Home/End move the active
 *  row, Escape cancels, Enter accepts whatever is active. `itemCount` can
 *  shrink out from under the current index — narrowing a query is the
 *  common case — so the effect below re-clamps it back into range whenever
 *  that happens, the same way a mouse hover already keeps it in sync. */
export function usePickerListNav(
  itemCount: number,
  opts: { onCancel: () => void; onAccept: (index: number) => void },
): {
  active: number;
  setActive: (index: number) => void;
  onKeyDown: (event: KeyboardEvent) => void;
} {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= itemCount) setActive(Math.max(0, itemCount - 1));
  }, [active, itemCount]);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); opts.onCancel(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, itemCount - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(Math.max(0, itemCount - 1)); }
    else if (event.key === 'Enter' && itemCount > 0) { event.preventDefault(); opts.onAccept(active); }
  }

  return { active, setActive, onKeyDown };
}

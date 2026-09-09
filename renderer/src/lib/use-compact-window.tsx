'use client';

// Nothing upstream drives the ambient size context (see @/lib/size-context)
// off real window width, so consumers that need a live compact/wide split —
// the Settings shell's nav rail vs. drawer, for instance — measure it here
// instead of reading a `compact` size variant that would otherwise never flip.

import { useEffect, useState } from 'react';

export function useCompactWindow(breakpointPx: number): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => setCompact(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [breakpointPx]);

  return compact;
}

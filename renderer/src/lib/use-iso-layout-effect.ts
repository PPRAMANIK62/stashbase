import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` in the browser, `useEffect` where there is no DOM.
 *
 * Every pre-paint measurement in this library needs the layout variant, but
 * React warns when `useLayoutEffect` runs during a server render. The choice
 * is made once here so the primitives share one definition instead of each
 * re-deriving it at module scope.
 */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

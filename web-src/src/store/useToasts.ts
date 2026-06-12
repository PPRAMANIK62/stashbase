import { useCallback, useRef } from 'react';
import type { Action } from './state';

export interface ToastOptions {
  level?: 'info' | 'success' | 'warning' | 'error';
  ttl?: number | null;
  action?: { label: string; onClick: () => void };
}

/**
 * Toast push/dismiss — lightweight non-blocking feedback. Extracted from
 * AppProvider; owns the id counter, leaves rendering to `Toasts.tsx` and
 * TTL bookkeeping to the reducer.
 *
 * Default ttl: info / success 3000ms, warning 5000ms, error null
 * (persistent — error toasts only go away when the user dismisses them).
 */
export function useToasts(dispatch: (a: Action) => void) {
  // Monotonic counter for toast ids — crypto.randomUUID would work
  // too, but a plain counter is enough (toasts are short-lived and
  // never persisted) and keeps test fixtures predictable.
  const toastSeq = useRef(0);

  const toast = useCallback((message: string, opts?: ToastOptions): string => {
    const level = opts?.level ?? 'info';
    // Per-level defaults: error is persistent so the user can't miss
    // it; warnings linger a bit longer than success/info; everything
    // else is a brisk 3 s.
    const defaultTtl =
      level === 'error' ? null
      : level === 'warning' ? 5000
      : 3000;
    const id = `toast-${++toastSeq.current}`;
    dispatch({
      type: 'TOAST_ADD',
      toast: {
        id,
        level,
        message,
        action: opts?.action,
        ttl: opts?.ttl !== undefined ? opts.ttl : defaultTtl,
      },
    });
    return id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'TOAST_DISMISS', id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { toast, dismissToast };
}

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSettingsBlocking } from '@/features/settings/hooks/useSettingsBlocking';
import { useApp } from '@/store/AppContext';
import { LazyLoadBoundary, lazyWithRetry } from '@/common/components/ErrorBoundary';
import { PICKER_VEIL_CLASS } from '@/common/lib/pickerChrome';

const ManagedQuickOpen = lazyWithRetry(() => import('./ManagedQuickOpen'));

interface QuickOpenRequest {
  commandsOnly: boolean;
  id: number;
}

/** Event ownership stays eager so the first shortcut cannot race the dynamic
 *  import. Ranking, command definitions, and picker rendering load only when
 *  Quick Open or the Command Palette is requested. */
export function QuickOpen() {
  const { state } = useApp();
  const settingsBlocking = useSettingsBlocking();
  const [request, setRequest] = useState<QuickOpenRequest | null>(null);
  const nextRequestId = useRef(0);
  const restoreRef = useRef<HTMLElement | null>(null);
  const blocked = Boolean(settingsBlocking || state.modal || state.cascadePrompt || state.ctxMenu || state.renaming);

  useEffect(() => {
    const onOpen = (event: Event) => {
      // Some blocking UI (notably Agent permission cards) owns local state
      // outside this reducer. Every blocking surface uses the shared modal
      // veil, so this final topmost check keeps the shortcut from escaping it.
      const commandsOnly = (event as CustomEvent<{ mode?: string }>).detail?.mode === 'commands';
      if (blocked || document.querySelector('.modal-veil, .quick-open-blocking') || (!commandsOnly && !state.folder)) return;
      restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      nextRequestId.current += 1;
      setRequest({ commandsOnly, id: nextRequestId.current });
    };
    window.addEventListener('stashbase-open-quick-open', onOpen);
    return () => window.removeEventListener('stashbase-open-quick-open', onOpen);
  }, [blocked, state.folder]);

  if (!request) return null;
  const close = () => {
    setRequest(null);
    requestAnimationFrame(() => restoreRef.current?.focus());
  };
  const loadingClass = `${PICKER_VEIL_CLASS} quick-open-blocking text-sm text-muted-foreground`;
  return (
    <LazyLoadBoundary className={loadingClass} label="Quick Open" resetKey={String(request.id)}>
      <Suspense fallback={<div className={loadingClass}>Opening Quick Open…</div>}>
        <ManagedQuickOpen key={request.id} commandsOnly={request.commandsOnly} onClose={close} />
      </Suspense>
    </LazyLoadBoundary>
  );
}

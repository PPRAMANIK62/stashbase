import { useEffect, useRef, useState } from 'react';
import { useSettingsBlocking } from '@/common/hooks/useSettingsBlocking';
import { useUiShell } from '@/store/contexts/AppContext';
import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { LazyManagedPicker } from '@/common/components/LazyManaged';
import { PICKER_VEIL_CLASS } from '@/common/lib/pickerChrome';
import { OPEN_LINK_FILE_PICKER_EVENT, type LinkFilePickerRequest } from '@/features/documents/milkdown/linkFilePickerTrigger';
import { cn } from '@/common/lib/utils';

const ManagedLinkFilePicker = lazyWithRetry(() => import('./ManagedLinkFilePicker'));

interface PendingRequest extends LinkFilePickerRequest {
  id: number;
}

/**
 * Always-mounted gate for the Markdown editor's "Link to file…" slash-menu
 * item, matching Quick Open's convention exactly: event ownership stays
 * eager so the request cannot race the dynamic import, and file ranking
 * plus the picker body load only once the item is actually chosen.
 */
export function LinkFilePicker() {
  const { modal, cascadePrompt, ctxMenu, renaming } = useUiShell();
  const settingsBlocking = useSettingsBlocking();
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const nextRequestId = useRef(0);
  const restoreRef = useRef<HTMLElement | null>(null);
  const blocked = Boolean(settingsBlocking || modal || cascadePrompt || ctxMenu || renaming);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<LinkFilePickerRequest>).detail;
      if (!detail) return;
      // Same final topmost check Quick Open makes: any blocking surface not
      // modeled in the reducer state still refuses a stacked picker, and the
      // request resolves as a cancel so the editor is left exactly as
      // `clearTextInCurrentBlockCommand` left it.
      if (blocked || document.querySelector('.modal-veil, .quick-open-veil, .quick-open-blocking')) {
        detail.onCancel();
        return;
      }
      restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      nextRequestId.current += 1;
      setRequest({ ...detail, id: nextRequestId.current });
    };
    window.addEventListener(OPEN_LINK_FILE_PICKER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_LINK_FILE_PICKER_EVENT, onOpen);
  }, [blocked]);

  if (!request) return null;
  const close = (selected: boolean) => {
    if (!selected) request.onCancel();
    setRequest(null);
    requestAnimationFrame(() => restoreRef.current?.focus());
  };
  const loadingClass = cn(PICKER_VEIL_CLASS, 'quick-open-blocking text-sm text-muted-foreground');
  return (
    <LazyManagedPicker
      as={ManagedLinkFilePicker}
      requestId={request.id}
      label="Link to file"
      loadingClass={loadingClass}
      componentProps={{
        onSelect: (path: string) => { request.onSelect(path); close(true); },
        onCancel: () => close(false),
      }}
    />
  );
}

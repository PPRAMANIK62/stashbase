import { useEffect, useRef, useState } from 'react';
import { useAppActions } from '@/store/contexts/AppContext';
import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { LazyManagedPicker } from '@/common/components/LazyManaged';
import { PICKER_VEIL_CLASS } from '@/common/lib/pickerChrome';
import {
  OPEN_MOVE_FILE_PICKER_EVENT,
  type MoveFilePickerRequest,
} from '@/features/workspace/lib/moveFilePickerTrigger';
import { basename } from '@/common/lib/paths';
import { cn } from '@/common/lib/utils';

const ManagedMoveFilePicker = lazyWithRetry(() => import('./ManagedMoveFilePicker'));

interface PendingRequest extends MoveFilePickerRequest {
  id: number;
}

/** Best-effort focus return to a tree row after the picker closes — the
 *  row is the surface the whole interaction started from (its context
 *  menu opened the picker with `returnFocus: false`). After a move the
 *  original row is gone, so the caller passes the row's NEW path; the
 *  row may also legitimately not exist yet (the tree reloads after a
 *  move), in which case focus stays where the browser put it. */
function focusTreeRow(path: string) {
  requestAnimationFrame(() => {
    const selector = `[data-path="${path.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"]`;
    const row = document.querySelector<HTMLElement>(selector);
    row?.focus({ preventScroll: false });
  });
}

/**
 * Always-mounted gate for the file row's "Move to…" action — the keyboard
 * path to the same `actions.moveFile` the drag-onto-a-folder drop calls.
 * Follows the Quick Open / Link-to-file convention: event ownership stays
 * eager so a request cannot race the dynamic import, while the picker
 * body (`ManagedMoveFilePicker`) loads only once the menu item is chosen.
 */
export function MoveFilePicker() {
  const { actions } = useAppActions();
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const nextRequestId = useRef(0);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<MoveFilePickerRequest>).detail;
      if (!detail) return;
      nextRequestId.current += 1;
      setRequest({ ...detail, id: nextRequestId.current });
    };
    window.addEventListener(OPEN_MOVE_FILE_PICKER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MOVE_FILE_PICKER_EVENT, onOpen);
  }, []);

  if (!request) return null;
  const loadingClass = cn(PICKER_VEIL_CLASS, 'quick-open-blocking text-sm text-muted-foreground');
  return (
    <LazyManagedPicker
      as={ManagedMoveFilePicker}
      requestId={request.id}
      label="Move to folder"
      loadingClass={loadingClass}
      componentProps={{
        filePath: request.path,
        onPick: (targetDir: string) => {
          const source = request.path;
          setRequest(null);
          void (async () => {
            const moved = await actions.moveFile(source, targetDir);
            focusTreeRow(moved
              ? (targetDir ? `${targetDir}/${basename(source)}` : basename(source))
              : source);
          })();
        },
        onCancel: () => {
          setRequest(null);
          focusTreeRow(request.path);
        },
      }}
    />
  );
}

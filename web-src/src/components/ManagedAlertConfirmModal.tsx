import { useRef } from 'react';
import type { ModalRequest } from '../store/state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export default function ManagedAlertConfirmModal({
  request,
  isTopmost,
  onResolve,
}: {
  request: ModalRequest;
  isTopmost: boolean;
  onResolve: (value: boolean) => void;
}) {
  const isConfirm = request.type === 'confirm';
  const requestRef = useRef(request);
  const resultRef = useRef(false);
  if (requestRef.current !== request) {
    requestRef.current = request;
    resultRef.current = false;
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && isTopmost) onResolve(resultRef.current);
      }}
    >
      <AlertDialogContent
        className="modal-card !z-[10001] !max-w-[90vw] !gap-0"
        overlayClassName="top !z-[10000]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="modal-title">
            {isConfirm ? 'Confirm action' : 'Notice'}
          </AlertDialogTitle>
          <AlertDialogDescription className="modal-hint">
            {request.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="modal-actions">
          {isConfirm && (
            <AlertDialogCancel className="modal-btn" onClick={() => {
              resultRef.current = false;
            }}>
              Cancel
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            className="modal-btn primary"
            autoFocus
            onClick={() => {
              resultRef.current = true;
            }}
          >
            {isConfirm ? 'Confirm' : 'OK'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

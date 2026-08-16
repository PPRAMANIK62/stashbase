import { Suspense } from 'react';
import { useAppActions, useUiShell } from '@/store/AppContext';
import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { useOverlayLayer } from '@/common/components/OverlayStack';
import { ModalLoadingStatus } from '@/common/components/ui/status';

const ManagedAlertConfirmModal = lazyWithRetry(() => import('@/common/components/ManagedAlertConfirmModal'));

export function AlertConfirmModal() {
  const { actions } = useAppActions();
  const { modal } = useUiShell();
  const layer = useOverlayLayer(modal !== null);
  if (!modal) return null;

  return (
    <Suspense
      fallback={(
        <ModalLoadingStatus
          label="Opening confirmation…"
          isTopmost={layer.isTopmost}
          onCancel={() => actions.resolveModal(false)}
        />
      )}
    >
      <ManagedAlertConfirmModal
        request={modal}
        isTopmost={layer.isTopmost}
        onResolve={actions.resolveModal}
      />
    </Suspense>
  );
}

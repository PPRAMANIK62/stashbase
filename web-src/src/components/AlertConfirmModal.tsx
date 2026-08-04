import { Suspense } from 'react';
import { useApp } from '../store/AppContext';
import { lazyWithRetry } from './ErrorBoundary';
import { useOverlayLayer } from './OverlayStack';
import { ModalLoadingStatus } from './ui/status';

const ManagedAlertConfirmModal = lazyWithRetry(() => import('./ManagedAlertConfirmModal'));

export function AlertConfirmModal() {
  const { state, actions } = useApp();
  const layer = useOverlayLayer(state.modal !== null);
  if (!state.modal) return null;

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
        request={state.modal}
        isTopmost={layer.isTopmost}
        onResolve={actions.resolveModal}
      />
    </Suspense>
  );
}

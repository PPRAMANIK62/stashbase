import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { LazyManagedModal } from '@/common/components/LazyManaged';

export interface ImportGitHubModalProps {
  onClose: () => void;
}

export interface ManagedImportGitHubModalProps extends ImportGitHubModalProps {
  isTopmost: boolean;
}

const ManagedImportGitHubModal = lazyWithRetry(() => import('./ManagedImportGitHubModal'));

export function ImportGitHubModal({ onClose }: ImportGitHubModalProps) {
  return (
    <LazyManagedModal<ManagedImportGitHubModalProps>
      as={ManagedImportGitHubModal}
      open
      label="Opening GitHub import…"
      onCancel={onClose}
      closeOnBackdrop
      componentProps={{ onClose }}
    />
  );
}

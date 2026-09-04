import type {
  QuickOpenNavigationIntent,
  QuickOpenSource,
} from '@/features/retrieval/domain/quick-open';

export type QuickOpenStatus = 'loading' | 'ready' | 'unavailable';

export interface QuickOpenProps {
  folderName: string;
  onClose(): void;
  onNavigate(intent: QuickOpenNavigationIntent): Promise<boolean>;
  onRetry(): void;
  open: boolean;
  revealLabel: string;
  sources: readonly QuickOpenSource[];
  status: QuickOpenStatus;
}

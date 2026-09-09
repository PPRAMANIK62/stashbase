import type { PreparationControlApi } from '@/features/preparation/application/ports';
import { sourceReadiness, type PreparedFormat } from '@/features/preparation/domain/readiness';
import { usePreparationActions } from '@/features/preparation/hooks/use-preparation-actions';
import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';
import type { SourceReference } from '@/shared/domain/source-reference';

import { PreparationStatusLine } from './status-line';

export interface SourcePreparationStatusProps {
  controlApi: PreparationControlApi;
  format: PreparedFormat;
  source: SourceReference;
  status: FolderIndexStatus | null;
}

/** Drop-in viewer row: projects the polled folder status onto one source and
 *  wires its reprocess and cancel controls. */
export function SourcePreparationStatus({
  controlApi,
  format,
  source,
  status,
}: SourcePreparationStatusProps) {
  const actions = usePreparationActions(controlApi, source);
  return (
    <PreparationStatusLine
      error={actions.error}
      format={format}
      onCancel={actions.cancel}
      onReprocess={() => void actions.reprocess()}
      pending={actions.pending}
      readiness={sourceReadiness(status, source.path)}
    />
  );
}

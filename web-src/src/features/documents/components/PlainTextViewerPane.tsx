import { EmptyState } from '@/common/components/ui/empty-state';
import { ConflictResolver } from '@/features/documents/components/ConflictResolver';
import { PlainTextDocument } from '@/features/documents/components/PlainTextDocument';
import type { Tab } from '@/store/state/state';

/** TXT-specific dispatch stays behind the format's dynamic entry so decode
 * failure and conflict chrome do not increase the always-loaded shell. */
export function PlainTextViewerPane({ tab }: { tab: Tab }) {
  const file = tab.file;
  if (!file || file.format !== 'txt') return null;
  if (tab.conflict) return <ConflictResolver tabId={tab.id} />;
  if (file.error) {
    return (
      <EmptyState layout="fill" role="alert">
        <span>Unsupported text encoding</span>
        <span>{file.error.message}</span>
      </EmptyState>
    );
  }
  return (
    <PlainTextDocument
      tabId={tab.id}
      content={file.content}
      readOnly={!tab.editMode}
      active
    />
  );
}

import type { DocumentTabsRuntime } from '@/features/documents/public';
import { Settings } from '@/features/settings/public';
import { ClipboardOffer, type WorkspaceRuntime } from '@/features/workspace/public';
import { applyCaptureWatch } from '@/platform/electron/capture';

import { useDependencies } from './dependency-context';
import type { SettingsCommand } from './use-workspace-commands';
import { WorkspaceQuickOpen } from './workspace-quick-open';

/** Everything that floats over the window: quick open, Settings, and the
 *  offer to save an image the reader copied. Each is bound to its own ports
 *  here so the layout only decides that they sit above everything else. */
export function WorkspaceDialogs({
  activeFolderPath,
  documents,
  onImported,
  quickOpen,
  settings,
  workspace,
}: {
  activeFolderPath: string | null;
  documents: DocumentTabsRuntime | null;
  onImported(): void;
  quickOpen: { close(): void; open: boolean };
  settings: SettingsCommand;
  workspace: WorkspaceRuntime | null;
}) {
  const dependencies = useDependencies();
  return (
    <>
      {workspace && documents && (
        <WorkspaceQuickOpen
          documents={documents}
          onClose={quickOpen.close}
          open={quickOpen.open}
          workspace={workspace}
        />
      )}
      <Settings
        agentRuntimeApi={dependencies.settings.agentRuntimeApi}
        applyCaptureWatch={(expected) => applyCaptureWatch(dependencies.capture, expected)}
        captureApi={dependencies.settings.captureApi}
        embedderApi={dependencies.settings.embedderApi}
        onClose={settings.close}
        onOpenExternal={(href) => void dependencies.documents.openExternal(href)}
        onSectionChange={settings.onSectionChange}
        open={settings.open}
        section={settings.section}
        transcriptionApi={dependencies.settings.transcriptionApi}
      />
      <ClipboardOffer
        activeFolderPath={activeFolderPath}
        capture={dependencies.workspace.adapters.clipboardCapture}
        onImported={onImported}
        upload={dependencies.workspace.adapters.upload}
      />
    </>
  );
}

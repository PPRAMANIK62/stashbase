import type { SettingsCommand } from '@/app/composition/commands/use-workspace-commands';
import { useDependencies } from '@/app/composition/dependency-context';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import { Settings } from '@/features/settings/public';
import { useSoftwareUpdate } from '@/features/updates/public';
import { ClipboardOffer, type WorkspaceRuntime } from '@/features/workspace/public';
import { applyCaptureWatch } from '@/platform/electron/capture';

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
  const softwareUpdate = useSoftwareUpdate(dependencies.updates);
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
        appearanceApi={dependencies.settings.appearanceApi}
        captureApi={dependencies.settings.captureApi}
        embedderApi={dependencies.settings.embedderApi}
        mcpAccessApi={dependencies.settings.mcpAccessApi}
        onClose={settings.close}
        onOpenExternal={(href) => void dependencies.documents.openExternal(href)}
        onSectionChange={settings.onSectionChange}
        open={settings.open}
        section={settings.section}
        softwareUpdate={dependencies.updates ? softwareUpdate : null}
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

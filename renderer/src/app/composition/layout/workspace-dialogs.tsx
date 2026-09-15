import type { ReactNode } from 'react';

import type { SettingsCommand } from '@/app/composition/commands/use-workspace-commands';
import { useDependencies } from '@/app/composition/dependency-context';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import { Settings } from '@/features/settings/public';
import { useSoftwareUpdate } from '@/features/updates/public';
import { type WorkspaceRuntime } from '@/features/workspace/public';

import { WorkspaceQuickOpen } from './workspace-quick-open';

/** Quick open and Settings, bound to their ports above the workspace. */
export function WorkspaceDialogs({
  documents,
  quickOpen,
  settings,
  updatePreview,
  workspace,
}: {
  documents: DocumentTabsRuntime | null;
  quickOpen: { close(): void; open: boolean };
  settings: SettingsCommand;
  updatePreview?: ReactNode;
  workspace: WorkspaceRuntime | null;
}) {
  const dependencies = useDependencies();
  const softwareUpdate = useSoftwareUpdate(dependencies.updates);
  const bugReport = dependencies.bugReport;
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
        accountApi={dependencies.settings.accountApi}
        agentRuntimeApi={dependencies.settings.agentRuntimeApi}
        appearanceApi={dependencies.settings.appearanceApi}
        telemetryApi={dependencies.settings.telemetryApi}
        embedderApi={dependencies.settings.embedderApi}
        mcpAccessApi={dependencies.settings.mcpAccessApi}
        localComponentApi={dependencies.settings.localComponentApi}
        onClose={settings.close}
        onOpenExternal={(href) => void dependencies.documents.openExternal(href)}
        onReportBug={bugReport ? () => void bugReport.open() : null}
        onSectionChange={settings.onSectionChange}
        open={settings.open}
        section={settings.section}
        softwareUpdate={dependencies.updates ? softwareUpdate : null}
        transcriptionApi={dependencies.settings.transcriptionApi}
        updatePreview={updatePreview}
      />
    </>
  );
}

import { Bot, Mic, Plug, Search, Settings as SettingsIcon, SunMoon } from 'lucide-react';

import { useLocalComponent } from '@/features/settings/hooks/use-local-component';

import { AgentRuntimesPanel } from './agents/agents-panel';
import { AiIndexPanel } from './ai-index/ai-index-panel';
import { AppearancePanel } from './appearance/appearance-panel';
import { GeneralPanel } from './general/general-panel';
import { McpAccessPanel } from './mcp/mcp-access-panel';
import type { SettingsProps } from './settings-types';
import { SettingsShell, type SettingsSectionDef } from './shell';
import { TranscriptionPanel } from './transcription/transcription-panel';

/** The section registry, in nav order: what everyone touches first, then the
 *  Agents section that owns the account, then the capabilities a reader turns
 *  on by bringing something of their own. Capability-specific panels require
 *  their ports; General always exposes the available update and support controls. */
const ignoreExternal = () => undefined;

export default function ManagedSettings({
  accountApi,
  agentRuntimeApi,
  appearanceApi,
  embedderApi,
  mcpAccessApi,
  localComponentApi,
  onClose,
  onOpenExternal = ignoreExternal,
  onReportBug = null,
  onSectionChange,
  open,
  section,
  softwareUpdate = null,
  transcriptionApi,
  telemetryApi,
}: SettingsProps) {
  const localComponent = useLocalComponent(localComponentApi, open && section === 'general');
  const sections: SettingsSectionDef[] = [
    {
      available: true,
      icon: SettingsIcon,
      id: 'general',
      label: 'General',
      render: () => (
        <GeneralPanel
          localComponent={localComponent}
          telemetryApi={telemetryApi}
          onOpenExternal={onOpenExternal}
          onReportBug={onReportBug}
          softwareUpdate={softwareUpdate}
        />
      ),
    },
    appearanceApi
      ? {
          available: true,
          icon: SunMoon,
          id: 'appearance',
          label: 'Appearance',
          render: () => <AppearancePanel appearanceApi={appearanceApi} />,
        }
      : { available: false, icon: SunMoon, id: 'appearance', label: 'Appearance' },
    {
      available: true,
      icon: Bot,
      id: 'agents',
      label: 'Agents',
      render: () => (
        <AgentRuntimesPanel
          accountApi={accountApi}
          agentRuntimeApi={agentRuntimeApi}
          onOpenExternal={onOpenExternal}
        />
      ),
    },
    transcriptionApi
      ? {
          available: true,
          icon: Mic,
          id: 'transcription',
          label: 'Transcription',
          render: () => <TranscriptionPanel transcriptionApi={transcriptionApi} />,
        }
      : { available: false, icon: Mic, id: 'transcription', label: 'Transcription' },
    embedderApi
      ? {
          available: true,
          icon: Search,
          id: 'ai-index',
          label: 'Search by Meaning',
          render: () => <AiIndexPanel embedderApi={embedderApi} />,
        }
      : { available: false, icon: Search, id: 'ai-index', label: 'Search by Meaning' },
    mcpAccessApi
      ? {
          available: true,
          icon: Plug,
          id: 'mcp',
          label: 'MCP',
          render: () => <McpAccessPanel mcpAccessApi={mcpAccessApi} />,
        }
      : { available: false, icon: Plug, id: 'mcp', label: 'MCP' },
  ];

  return (
    <SettingsShell
      onClose={onClose}
      onSectionChange={onSectionChange}
      open={open}
      section={section}
      sections={sections}
    />
  );
}

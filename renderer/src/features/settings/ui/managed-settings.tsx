import { Bot, Mic, Plug, Search, Settings as SettingsIcon, SunMoon } from 'lucide-react';

import { AgentRuntimesPanel } from './agents/agents-panel';
import { AiIndexPanel } from './ai-index/ai-index-panel';
import { GeneralPanel } from './general/general-panel';
import { McpAccessPanel } from './mcp/mcp-access-panel';
import type { SettingsProps } from './settings-types';
import { SettingsShell, type SettingsSectionDef } from './shell';
import { TranscriptionPanel } from './transcription/transcription-panel';

/** The section registry. Each panel owns its own data, so a section is the
 *  one place a capability's absence is decided: no port, no section. */
const alwaysApplied = async () => true;
const ignoreExternal = () => undefined;

export default function ManagedSettings({
  agentRuntimeApi,
  applyCaptureWatch = alwaysApplied,
  captureApi,
  embedderApi,
  mcpAccessApi,
  onClose,
  onOpenExternal = ignoreExternal,
  onSectionChange,
  open,
  section,
  transcriptionApi,
}: SettingsProps) {
  const sections: SettingsSectionDef[] = [
    captureApi
      ? {
          available: true,
          icon: SettingsIcon,
          id: 'general',
          label: 'General',
          render: () => (
            <GeneralPanel applyCaptureWatch={applyCaptureWatch} captureApi={captureApi} />
          ),
        }
      : { available: false, icon: SettingsIcon, id: 'general', label: 'General' },
    { available: false, icon: SunMoon, id: 'appearance', label: 'Appearance' },
    {
      available: true,
      icon: Bot,
      id: 'agents',
      label: 'Agents',
      render: () => <AgentRuntimesPanel agentRuntimeApi={agentRuntimeApi} />,
    },
    embedderApi
      ? {
          available: true,
          icon: Search,
          id: 'ai-index',
          label: 'AI Index',
          render: () => <AiIndexPanel embedderApi={embedderApi} onOpenExternal={onOpenExternal} />,
        }
      : { available: false, icon: Search, id: 'ai-index', label: 'AI Index' },
    transcriptionApi
      ? {
          available: true,
          icon: Mic,
          id: 'transcription',
          label: 'Transcription',
          render: () => <TranscriptionPanel transcriptionApi={transcriptionApi} />,
        }
      : { available: false, icon: Mic, id: 'transcription', label: 'Transcription' },
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

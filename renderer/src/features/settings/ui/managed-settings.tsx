import { Bot, Mic, Plug, Search, Settings as SettingsIcon, SunMoon } from 'lucide-react';

import { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';

import { AgentRuntimesPanel } from './agents/agents-panel';
import { SettingsShell, type SettingsSectionDef } from './shell';
import type { SettingsProps } from './settings-types';

export default function ManagedSettings({
  agentRuntimeApi,
  onClose,
  onSectionChange,
  open,
  section,
}: SettingsProps) {
  const runtimes = useAgentRuntimes(agentRuntimeApi);

  const sections: SettingsSectionDef[] = [
    { available: false, icon: SettingsIcon, id: 'general', label: 'General' },
    { available: false, icon: SunMoon, id: 'appearance', label: 'Appearance' },
    {
      available: true,
      icon: Bot,
      id: 'agents',
      label: 'Agents',
      render: () => <AgentRuntimesPanel runtimes={runtimes} />,
    },
    { available: false, icon: Search, id: 'ai-index', label: 'AI Index' },
    { available: false, icon: Mic, id: 'transcription', label: 'Transcription' },
    { available: false, icon: Plug, id: 'mcp', label: 'MCP' },
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

import { Bot, Mic, Plug, Search, Settings as SettingsIcon, SunMoon } from 'lucide-react';

import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type { CapturePort, TranscriptionPort } from '@/features/settings/application/ports';
import { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';
import { useCapture } from '@/features/settings/hooks/use-capture';
import { useEmbedder } from '@/features/settings/hooks/use-embedder';
import { useTranscription } from '@/features/settings/hooks/use-transcription';

import { AgentRuntimesPanel } from './agents/agents-panel';
import { AiIndexPanel } from './ai-index/ai-index-panel';
import { GeneralPanel } from './general/general-panel';
import type { SettingsProps } from './settings-types';
import { SettingsShell, type SettingsSectionDef } from './shell';
import { TranscriptionPanel } from './transcription/transcription-panel';

const noWatch = async () => true;
const ignoreExternal = () => undefined;

function GeneralSection({
  applyCaptureWatch,
  captureApi,
}: {
  applyCaptureWatch: (expected: boolean) => Promise<boolean>;
  captureApi: CapturePort;
}) {
  const capture = useCapture(captureApi, applyCaptureWatch);
  return <GeneralPanel capture={capture} />;
}

function AiIndexSection({
  embedderApi,
  onOpenExternal,
  open,
}: {
  embedderApi: EmbedderPort;
  onOpenExternal(href: string): void;
  open: boolean;
}) {
  const embedder = useEmbedder(embedderApi, open);
  return <AiIndexPanel embedder={embedder} onOpenExternal={onOpenExternal} />;
}

function TranscriptionSection({ transcriptionApi }: { transcriptionApi: TranscriptionPort }) {
  const transcription = useTranscription(transcriptionApi);
  return <TranscriptionPanel transcription={transcription} />;
}

export default function ManagedSettings({
  agentRuntimeApi,
  applyCaptureWatch = noWatch,
  captureApi,
  embedderApi,
  onClose,
  onOpenExternal = ignoreExternal,
  onSectionChange,
  open,
  section,
  transcriptionApi,
}: SettingsProps) {
  const runtimes = useAgentRuntimes(agentRuntimeApi);

  const sections: SettingsSectionDef[] = [
    captureApi
      ? {
          available: true,
          icon: SettingsIcon,
          id: 'general',
          label: 'General',
          render: () => (
            <GeneralSection applyCaptureWatch={applyCaptureWatch} captureApi={captureApi} />
          ),
        }
      : { available: false, icon: SettingsIcon, id: 'general', label: 'General' },
    { available: false, icon: SunMoon, id: 'appearance', label: 'Appearance' },
    {
      available: true,
      icon: Bot,
      id: 'agents',
      label: 'Agents',
      render: () => <AgentRuntimesPanel runtimes={runtimes} />,
    },
    embedderApi
      ? {
          available: true,
          icon: Search,
          id: 'ai-index',
          label: 'AI Index',
          render: () => (
            <AiIndexSection embedderApi={embedderApi} onOpenExternal={onOpenExternal} open={open} />
          ),
        }
      : { available: false, icon: Search, id: 'ai-index', label: 'AI Index' },
    transcriptionApi
      ? {
          available: true,
          icon: Mic,
          id: 'transcription',
          label: 'Transcription',
          render: () => <TranscriptionSection transcriptionApi={transcriptionApi} />,
        }
      : { available: false, icon: Mic, id: 'transcription', label: 'Transcription' },
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

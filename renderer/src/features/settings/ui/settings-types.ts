import type { AgentRuntimePort } from '@/features/settings/application/ports';

export interface SettingsProps {
  agentRuntimeApi: AgentRuntimePort;
  onClose: () => void;
  onSectionChange: (id: string) => void;
  open: boolean;
  section: string;
}

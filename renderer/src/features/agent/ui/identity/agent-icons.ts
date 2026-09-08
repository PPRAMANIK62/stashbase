import { Layers } from 'lucide-react';

import type { AgentId } from '@/features/agent/domain/session';
import type { IconComponent } from '@/lib/icon-context';

import { ClaudeCodeIcon, CodexIcon } from './brand-icons';

export const AGENT_ICONS: Record<AgentId, IconComponent> = {
  stashbase: Layers,
  codex: CodexIcon,
  claude: ClaudeCodeIcon,
};

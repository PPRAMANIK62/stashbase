import type { AgentId } from '@/features/agent/domain/session';
import type { IconComponent } from '@/lib/icon-context';

import { ClaudeCodeIcon, CodexIcon, OpenQuillIcon } from './brand-icons';

export const AGENT_ICONS: Record<AgentId, IconComponent> = {
  stashbase: OpenQuillIcon,
  codex: CodexIcon,
  claude: ClaudeCodeIcon,
};

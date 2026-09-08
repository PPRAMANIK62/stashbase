import type { AgentId } from '@/features/agent/domain/session';
import type { Agent } from '@/shared/agent-runtime';

export const AGENT_ORDER: AgentId[] = ['codex', 'claude', 'stashbase'];
export const AGENT_LABELS: Record<AgentId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  stashbase: 'Built-in',
};

export function isReadyAgent(agent: Agent): boolean {
  return agent.bootstrap?.phase === 'ready' && agent.state !== 'failed';
}

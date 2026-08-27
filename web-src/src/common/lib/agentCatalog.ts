/** Lives in `common/` because `store/contexts/ActionsContext.tsx` needs it and
 * `store/` may not import a feature — not because it is feature-agnostic.
 * Every other consumer is in `features/agent-panel/`. Do not "tidy" it down
 * into that feature; see "Where shared code goes" in
 * `code-review/renderer-architecture.md`. */
import type { ComponentType } from 'react';
import { ClaudeIcon, CodexIcon, CubeLogoIcon } from '@/common/components/icons';
import type { AgentId } from '@shared/agent-protocol';

export type AgentKind = AgentId;

/** Bootstrap contract used until the server has returned live runtime
 * discovery. The server descriptor takes precedence once available. */
export interface AgentPanelCapabilities {
  connection: true;
  prompts: true;
  interrupt: true;
  transcript: true;
  approvals: true;
  history: true;
  attachments: boolean;
  modes: boolean;
  effort: boolean;
  models: boolean;
  skills: boolean;
  steering: boolean;
  titleHint: boolean;
}

export interface AgentMeta {
  id: AgentKind;
  name: string;
  shortName: string;
  launcherLabel: string;
  capabilities: AgentPanelCapabilities;
  controlsNote: string;
  Icon: ComponentType<{ className?: string }>;
}

export const AGENT_META: Record<AgentKind, AgentMeta> = {
  stashbase: {
    id: 'stashbase',
    name: 'Default',
    shortName: 'Default',
    launcherLabel: 'Default',
    capabilities: { connection: true, prompts: true, interrupt: true, transcript: true, approvals: true, history: true, attachments: false, modes: false, effort: false, models: false, skills: false, steering: false, titleHint: true },
    controlsNote: 'Runs locally · Model usage uses your StashBase allowance',
    Icon: CubeLogoIcon,
  },
  claude: {
    id: 'claude',
    name: 'Claude Code',
    shortName: 'Claude',
    launcherLabel: 'Claude Code',
    capabilities: { connection: true, prompts: true, interrupt: true, transcript: true, approvals: true, history: true, attachments: true, modes: true, effort: true, models: true, skills: true, steering: false, titleHint: false },
    controlsNote: 'Access applies live · Effort on new session',
    Icon: ClaudeIcon,
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    shortName: 'Codex',
    launcherLabel: 'Codex',
    capabilities: { connection: true, prompts: true, interrupt: true, transcript: true, approvals: true, history: true, attachments: true, modes: true, effort: true, models: true, skills: true, steering: true, titleHint: true },
    controlsNote: 'Access and effort apply on new session',
    Icon: CodexIcon,
  },
};

export const AGENTS: AgentMeta[] = [AGENT_META.codex, AGENT_META.claude, AGENT_META.stashbase];

export function isAgentKind(value: string): value is AgentKind {
  return value === 'stashbase' || value === 'claude' || value === 'codex';
}

export function agentMeta(value: string): AgentMeta {
  return isAgentKind(value) ? AGENT_META[value] : AGENT_META.stashbase;
}

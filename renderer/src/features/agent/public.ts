export { createAgentCatalogAdapter } from './infrastructure/catalog-api';
export { createAgentContextAdapter } from './infrastructure/context-api';
export { createAgentSessionAdapter } from './infrastructure/session-api';
export { AgentChats, AgentWorkspace } from './ui/workspace-lazy';
export { AgentTitlebar } from './ui/titlebar';
export { useAgentWorkspaceRuntime } from './hooks/use-agent-workspace-runtime';
export { agentSurfaceProps, useAgentComposerFocused } from './ui/composer/focus';
export type { AgentCatalogPort, AgentContextPort, AgentSessionPort } from './application/ports';
export type { AgentFilesChanged } from './application/session-runtime';
export type { AgentScopeEnvironment } from './domain/context';
export type { AgentScope } from './domain/session';
export type {
  AgentInstructions,
  AgentInstructionsPort,
} from './application/ports';
export { createAgentInstructionsAdapter } from './infrastructure/agent-instructions-api';
export {
  useAgentInstructions,
  type AgentInstructionsEditor,
} from './hooks/use-agent-instructions';
export type { AgentWorkspaceRuntime } from './application/workspace-runtime';
export type { AgentScopeOutline } from './domain/starters';

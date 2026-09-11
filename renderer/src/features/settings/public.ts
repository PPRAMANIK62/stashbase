export {
  type AccountPort,
  type AgentRuntimePort,
  type AppearancePort,
  type CapturePort,
  type McpAccessPort,
  type TranscriptionPort,
} from './application/ports';
export { type EmbedderPort } from './application/embedder-port';
export { createAccountAdapter } from './infrastructure/account-api';
export { createAgentRuntimeAdapter } from './infrastructure/agent-runtime-api';
export { createMcpAccessAdapter } from './infrastructure/mcp-access-api';
export { createEmbedderAdapter } from './infrastructure/embedder-api';
export { createAppearanceAdapter } from './infrastructure/appearance-api';
export { createCaptureAdapter } from './infrastructure/capture-api';
export { createTranscriptionAdapter } from './infrastructure/transcription-api';
export { appearanceSurface } from './domain/appearance';
export { useSearchKeyConfigured } from './hooks/use-embedder';
export { SidebarAccountRow } from './ui/account/sidebar-account-row';
export { Settings } from './ui/settings';
export type { SettingsSectionId } from './ui/settings-types';

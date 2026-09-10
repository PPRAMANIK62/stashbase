export {
  type AgentRuntimePort,
  type AppearancePort,
  type CapturePort,
  type OnboardingPort,
  type McpAccessPort,
  type TranscriptionPort,
} from './application/ports';
export { type EmbedderPort } from './application/embedder-port';
export { createAgentRuntimeAdapter } from './infrastructure/agent-runtime-api';
export { createMcpAccessAdapter } from './infrastructure/mcp-access-api';
export { createEmbedderAdapter } from './infrastructure/embedder-api';
export { createAppearanceAdapter } from './infrastructure/appearance-api';
export { createCaptureAdapter } from './infrastructure/capture-api';
export { createOnboardingAdapter } from './infrastructure/onboarding-api';
export { createTranscriptionAdapter } from './infrastructure/transcription-api';
export { appearanceSurface } from './domain/appearance';
export {
  useSearchSetupInvitation,
  type SearchSetupInvitationView,
} from './hooks/use-search-setup-invitation';
export { Settings } from './ui/settings';
export type { SettingsSectionId } from './ui/settings-types';

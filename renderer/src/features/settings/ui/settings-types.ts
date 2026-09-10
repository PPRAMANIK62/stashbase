import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type {
  AgentRuntimePort,
  CapturePort,
  McpAccessPort,
  TranscriptionPort,
} from '@/features/settings/application/ports';

/** Every section the Settings shell registers, in nav order. A section id
 *  that is not one of these cannot be registered — the mistake fails to
 *  typecheck instead of quietly rendering an empty pane. */
const SETTINGS_SECTION_IDS = [
  'general',
  'appearance',
  'agents',
  'ai-index',
  'transcription',
  'mcp',
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export interface SettingsProps {
  agentRuntimeApi: AgentRuntimePort;
  /** Resolves true when the desktop watch matches the saved opt-in; absent outside Electron. */
  applyCaptureWatch?: (expected: boolean) => Promise<boolean>;
  captureApi?: CapturePort;
  embedderApi?: EmbedderPort;
  mcpAccessApi?: McpAccessPort;
  onClose: () => void;
  onOpenExternal?: (href: string) => void;
  onSectionChange: (id: SettingsSectionId) => void;
  open: boolean;
  /** The section the app asked for. */
  section: SettingsSectionId;
  transcriptionApi?: TranscriptionPort;
}

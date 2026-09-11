import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type {
  AgentRuntimePort,
  AppearancePort,
  CapturePort,
  McpAccessPort,
  TranscriptionPort,
} from '@/features/settings/application/ports';
import type { SoftwareUpdateRow } from '@/shared/domain/software-update';

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
  appearanceApi?: AppearancePort;
  captureApi?: CapturePort;
  embedderApi?: EmbedderPort;
  mcpAccessApi?: McpAccessPort;
  onClose: () => void;
  onOpenExternal?: (href: string) => void;
  /** Asks the desktop to open the bug-report review. Null or absent outside
   *  the desktop app, and then General shows the row disabled and says why. */
  onReportBug?: (() => void) | null;
  onSectionChange: (id: SettingsSectionId) => void;
  open: boolean;
  /** The section the app asked for. */
  section: SettingsSectionId;
  /** How this build keeps itself current, filled in by whoever owns updating.
   *  Null or absent where the build has no updater, and then General says
   *  nothing about updates at all. */
  softwareUpdate?: SoftwareUpdateRow | null;
  transcriptionApi?: TranscriptionPort;
}

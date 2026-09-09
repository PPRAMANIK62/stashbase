import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type {
  AgentRuntimePort,
  CapturePort,
  TranscriptionPort,
} from '@/features/settings/application/ports';

export interface SettingsProps {
  agentRuntimeApi: AgentRuntimePort;
  /** Resolves true when the desktop watch matches the saved opt-in; absent outside Electron. */
  applyCaptureWatch?: (expected: boolean) => Promise<boolean>;
  captureApi?: CapturePort;
  embedderApi?: EmbedderPort;
  onClose: () => void;
  onOpenExternal?: (href: string) => void;
  onSectionChange: (id: string) => void;
  open: boolean;
  section: string;
  transcriptionApi?: TranscriptionPort;
}

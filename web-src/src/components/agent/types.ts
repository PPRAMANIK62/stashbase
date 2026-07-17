export type PermMode = 'default' | 'acceptEdits' | 'plan' | 'auto';

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ToolStatus = 'running' | 'awaiting' | 'done' | 'error' | 'denied';

/** A context file attached to the composer, shown as a removable chip.
 *  `path` is the folder-relative path (sent to the agent); `dims` is the
 *  pixel size for images (chip label only). */
export interface Attachment { path: string; name: string; dims?: string }

export interface ToolBlock {
  kind: 'tool';
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  /** Set while a permission prompt for this tool is pending. */
  permId?: string;
  permTitle?: string | null;
  result?: string;
}

export type Block =
  | { kind: 'user'; id: string; text: string; attachments?: Attachment[] }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'error'; id: string; text: string }
  | ToolBlock;

export type ServerEvent = AgentServerEvent;

export type AgentKind = 'claude' | 'codex';
import type { AgentServerEvent } from '../../../../server/agent-contract.ts';

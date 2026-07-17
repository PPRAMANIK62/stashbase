/**
 * Stable Codex adapter facade.
 *
 * Live session lifecycle, approval policy, history, process spawning, and
 * protocol normalization live in focused modules beside this file.
 */
export {
  attachCodexWebSocket,
  killActiveCodex,
} from './codex-session-runtime.ts';
export {
  codexAccessOptions,
  isStashbaseWorkspaceEdit,
  isWorkspaceFileChange,
} from './codex-approval.ts';
export {
  deleteCodexSession,
  getCodexSessionMessages,
  listCodexSessions,
  permanentlyDeleteCodexThread,
  renameCodexSession,
  type CodexSessionBlock,
  type CodexSessionRow,
} from './codex-history.ts';

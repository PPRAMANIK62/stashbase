import { resolveAgentInstructions } from './agent-instructions.ts';

/** Product-owned routing policy for native Agent runtimes. This policy is not
 * part of the user-editable Agent Instructions surface: adapters compose it
 * only when starting a native session. */
export const STASHBASE_AGENT_RUNTIME_POLICY = [
  '<stashbase_runtime_policy>',
  "Use StashBase MCP tools as the primary interface for the user's library.",
  '- Search and orient with the StashBase MCP `search_library` and `list_directory` tools before scanning files with native shell or filesystem tools.',
  '- Search within the current chat scope by default. Use search_library with scope: "library" only when the user requests global search; do not broaden an empty search automatically.',
  '- Read PDFs, DOCX, audio, and video with the StashBase MCP `read_file` tool, which returns prepared text.',
  '- Do not install or run a separate parser for prepared content unless the user explicitly requests original-source analysis or `read_file` reports that prepared text is unavailable.',
  '</stashbase_runtime_policy>',
].join('\n');

export function composeAgentRuntimeInstructions(agentInstructions?: string): string {
  return agentInstructions
    ? `${agentInstructions}\n\n${STASHBASE_AGENT_RUNTIME_POLICY}`
    : STASHBASE_AGENT_RUNTIME_POLICY;
}

export function resolveAgentRuntimeInstructions(folderPath: string | null): string {
  return composeAgentRuntimeInstructions(resolveAgentInstructions(folderPath));
}

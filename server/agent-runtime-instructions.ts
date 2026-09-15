import { resolveAgentInstructions } from './agent-instructions.ts';

/** Product-owned routing policy for native Agent runtimes. This policy is not
 * part of the user-editable Agent Instructions surface: adapters compose it
 * only when starting a native session. */
export const STASHBASE_AGENT_RUNTIME_POLICY = [
  '<stashbase_runtime_policy>',
  "Use StashBase MCP tools for the conversation's bound project.",
  '- Search and orient with the StashBase MCP `search_project` and `list_directory` tools before scanning files with native shell or filesystem tools.',
  '- Every file operation and search targets the bound project only. Never iterate projects to simulate global search.',
  '- Read PDFs and DOCX with the StashBase MCP `read_file` tool, which returns prepared text.',
  '- Do not install or run a separate parser for prepared content unless the user explicitly requests original-source analysis or `read_file` reports that prepared text is unavailable.',
  '</stashbase_runtime_policy>',
].join('\n');

export function composeAgentRuntimeInstructions(agentInstructions?: string): string {
  return agentInstructions
    ? `${agentInstructions}\n\n${STASHBASE_AGENT_RUNTIME_POLICY}`
    : STASHBASE_AGENT_RUNTIME_POLICY;
}

export function resolveAgentRuntimeInstructions(folderPath: string): string {
  return composeAgentRuntimeInstructions(resolveAgentInstructions(folderPath));
}

import { useTextEntryFocused } from '@/shared/runtime/use-text-entry-focused';

/** Spread on whatever element hosts the Agent workspace. The feature owns the
 *  marker so the shell never has to name an Agent selector of its own. */
export const agentSurfaceProps = { 'data-agent-surface': '' } as const;

const AGENT_SURFACE_SELECTOR = '[data-agent-surface]';

/** True while a text field inside the Agent workspace owns focus. */
export function useAgentComposerFocused(): boolean {
  return useTextEntryFocused(AGENT_SURFACE_SELECTOR);
}

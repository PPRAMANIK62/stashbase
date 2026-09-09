import { useTextEntryFocused } from '@/lib/runtime/use-text-entry-focused';

/** Spread on whatever element hosts the Agent workspace. The feature owns the
 *  marker so the shell never has to name an Agent selector of its own. */
export const agentSurfaceProps = { 'data-agent-surface': '' } as const;

const AGENT_SURFACE_SELECTOR = '[data-agent-surface]';

/** True while a text field inside the Agent workspace owns focus, so a
 *  clipboard image pasted into the composer is never also offered as an
 *  import. */
export function useAgentComposerFocused(): boolean {
  return useTextEntryFocused(AGENT_SURFACE_SELECTOR);
}

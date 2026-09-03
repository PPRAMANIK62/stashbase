/**
 * Empty-chat hero pieces. While a chat has no turns, AgentView centers the
 * composer in the panel: a title (plus a connecting status when applicable)
 * sits above it. When a Template's prompt is staged but not yet placed in
 * the composer, its progress line sits directly below the composer.
 */
import { Button } from '@/common/components/ui/button';
import { SectionHeading } from '@/common/components/ui/section';
import { spinnerClass } from '@/features/agent-panel/lib/panelStyles';

/** The staged wiki prompt's progress line. The standing Build Wiki button
 * retired when the Templates gallery became the sole home of starting a
 * wiki (its sidebar row is the one entry point — a second route under
 * the composer competed with it). What remains is the state the user
 * must still see HERE: a Template was used, the agent is not ready yet,
 * and the staged prompt (it lands in the composer once the agent is
 * ready — the user sends it) can be cancelled. */
export function BuildWikiPagesAction({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-4 text-center">
      {/* A progress row, not a disabled button — that is where the eye
        * looks for waiting state. */}
      <p className="m-0 flex max-w-measure-sm items-center gap-1.5 text-xs leading-snug text-muted-foreground" role="status">
        <span className={spinnerClass} aria-hidden="true" />
        Template waiting for Agent setup. <Button type="button" variant="link" size="xs" className="h-auto border-0 p-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={onCancel}>Cancel</Button>
      </p>
    </div>
  );
}

/** Title + status slot above the centered composer. The title names the
 * space's promise; runtime identity still lives in the tab icon and the
 * composer's "Message <Agent>…" placeholder, and the scope pill carries
 * the scope — no wordmark or agent branding here. While a session
 * connects, a spinner row shows between the title and the composer. */
export function EmptyChatGreeting({ agentShortName, connecting }: {
  agentShortName: string;
  connecting: boolean;
}) {
  return (
    <>
      {/* Level 2, stated: pane-level surfaces top the chat pane's outline
        * at h2 (see the scheme note on RuntimeCard). */}
      <SectionHeading level={2} className="pb-6 text-center text-2xl">
        Your Wiki is here.
      </SectionHeading>
      {connecting && (
        <p className="m-0 flex items-center justify-center gap-2 pb-4 text-sm text-muted-foreground" role="status">
          <span className={spinnerClass} aria-hidden="true" />
          Connecting to {agentShortName}…
        </p>
      )}
    </>
  );
}

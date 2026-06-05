/**
 * Placeholder for the structured Codex panel — same chrome as the Claude
 * `AgentView` (header + empty-state hero), but the SDK-backed plumbing
 * isn't built yet, so the body is just a "Coming soon" notice (no
 * composer — there's nothing to send to). Codex chats route here (see
 * ChatPane); the raw terminal entry is retired until the real panel lands.
 *
 * Tracking: design-docs/chat-panel.md — Codex structured panel.
 */
import { CodexIcon, NewChatIcon, HistoryIcon } from '../icons';

export function CodexView({ title }: { title: string }) {
  return (
    <div className="agent-view">
      <div className="agent-head">
        <span className="agent-head-title">{title}</span>
        <div className="agent-head-actions">
          <button type="button" className="agent-head-btn" title="History (coming soon)" disabled>
            <HistoryIcon />
          </button>
          <button type="button" className="agent-head-btn" title="New Codex chat (coming soon)" disabled>
            <NewChatIcon />
          </button>
        </div>
      </div>

      <div className="agent-messages">
        <div className="agent-hero">
          <div className="agent-hero-wordmark">
            <CodexIcon className="agent-hero-mark" />
            <span className="agent-hero-name">Codex</span>
          </div>
          <div className="agent-coming-soon">
            <span className="agent-coming-soon-pill">Coming soon</span>
            <p className="agent-coming-soon-note">
              The structured Codex panel isn't ready yet. It'll land here
              with the same bubbles, tool cards, and inline diffs as Claude.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

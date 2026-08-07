/** Pure state for the sidebar's session-history menus and the resume
 * handoff channel. Kept free of React so the merged listing and the
 * consume rule stay covered without a browser harness (mirrors
 * `folderState.ts`).
 *
 * History lives on the sidebar's scope headers (the active folder's
 * header row, and the Library section header), one menu per scope. Each
 * menu merges BOTH agents' sessions for that scope; a row remembers its
 * agent so rename/delete/resume route through the right runtime.
 *
 * Resume is a store handoff: the sidebar records a `PendingChatResume`
 * (CHAT_RESUME_REQUEST) and activates a suitable chat tab via the New
 * Chat plan (`newChatPlan` — reuse the one completely blank tab,
 * switching its agent in place when needed, else create). The target
 * tab's AgentView consumes the request (CHAT_RESUME_CONSUMED) and
 * resumes the session within the request's scope.
 */
import type { SessionInfo } from '../../api';
import type { AgentKind } from '../../agentCatalog';

/** One agent's listing result for a scope: its sessions, or `null` when
 * that agent's fetch failed. */
export interface AgentSessionList {
  agent: AgentKind;
  sessions: SessionInfo[] | null;
}

/** A history row: one agent's session, tagged with its agent so row
 * actions (resume / rename / delete) route through that runtime. */
export interface MergedSessionRow extends SessionInfo {
  agent: AgentKind;
}

export interface MergedSessions {
  /** All loaded sessions across agents, newest first. */
  rows: MergedSessionRow[];
  /** Agents whose listing failed. The menu shows the loaded rows plus a
   * quiet inline note for these — one agent failing must not blank the
   * other's history. */
  failed: AgentKind[];
}

/** Merge per-agent listings into one newest-first list. Stable within an
 * agent (server order is already newest first); ties across agents keep
 * input agent order. */
export function mergeAgentSessions(lists: readonly AgentSessionList[]): MergedSessions {
  const rows: MergedSessionRow[] = [];
  const failed: AgentKind[] = [];
  for (const list of lists) {
    if (list.sessions === null) {
      failed.push(list.agent);
      continue;
    }
    for (const session of list.sessions) rows.push({ ...session, agent: list.agent });
  }
  rows.sort((a, b) => b.lastModified - a.lastModified);
  return { rows, failed };
}

/** Whether an AgentView should consume the pending sidebar resume: only
 * the ACTIVE tab, only when it runs the request's agent, and only while
 * it is still completely blank — a tab holding user work is never
 * hijacked into another conversation. */
export function shouldConsumePendingResume(options: {
  active: boolean;
  tabAgent: string;
  requestAgent: string;
  blank: boolean;
}): boolean {
  return options.active && options.tabAgent === options.requestAgent && options.blank;
}

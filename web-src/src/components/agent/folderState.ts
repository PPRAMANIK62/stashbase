/** Pure state for the composer's session-scope pill (the Cursor-style
 * scope picker). Kept free of React so default/lock/follow-window
 * semantics stay covered without a browser harness, mirroring
 * `modelState.ts`.
 *
 * Scope model: a chat is explicitly scoped either to one library folder
 * or to the whole library. A missing choice is NOT a scope — the
 * default resolves to the window's current folder when one exists, else
 * to the library.
 *
 * Semantics:
 * - A tab with no started session follows the window's current folder
 *   until the user explicitly picks a scope (a folder or "Library").
 * - Once the session has content (or is resumed), the binding is fixed:
 *   the pill keeps showing the scope the session connected with, and a
 *   later window-folder switch must not rebind it.
 * - A tab with unsent draft text or attachments freezes its scope at
 *   what the user saw instead of silently following the window.
 */

/** Explicit chat scope: one library folder, or the whole library. */
export type ChatScope = { kind: 'library' } | { kind: 'folder'; path: string };

export const LIBRARY_SCOPE: ChatScope = { kind: 'library' };

export function folderScope(path: string): ChatScope {
  return { kind: 'folder', path };
}

export function chatScopesEqual(a: ChatScope | null | undefined, b: ChatScope | null | undefined): boolean {
  if (!a || !b) return a === b || (!a && !b);
  if (a.kind === 'library') return b.kind === 'library';
  return b.kind === 'folder' && b.path === a.path;
}

export interface LibraryFolderOption {
  path: string;
  favorite?: boolean;
}

/** Folder entries for the picker: the same membership list the sidebar
 * shows (`state.recent`), favorites pinned first, both groups keeping the
 * server's recents order. The current window folder is ensured so the
 * default choice is always present even before recents load. The
 * "Library" entry is rendered separately above these. */
export function folderMenuEntries(
  recent: readonly { path: string; favorite?: boolean }[],
  windowFolder: string,
): LibraryFolderOption[] {
  const favorites = recent.filter((entry) => entry.favorite);
  const others = recent.filter((entry) => !entry.favorite);
  const ordered: LibraryFolderOption[] = [...favorites, ...others]
    .map(({ path, favorite }) => ({ path, ...(favorite ? { favorite: true } : {}) }));
  if (windowFolder && !ordered.some((entry) => entry.path === windowFolder)) {
    ordered.unshift({ path: windowFolder });
  }
  return ordered;
}

/** The scope a NEW session would bind: the explicit pick, else the
 * window's current folder, else the whole library. An explicit folder
 * pick that has left library membership (folder removed) is ignored so
 * the picker cannot bind a dead folder. */
export function nextSessionScope(
  picked: ChatScope | undefined,
  windowFolder: string,
  memberPaths: readonly string[],
): ChatScope {
  if (picked?.kind === 'library') return LIBRARY_SCOPE;
  if (picked?.kind === 'folder' && memberPaths.includes(picked.path)) return picked;
  return windowFolder ? folderScope(windowFolder) : LIBRARY_SCOPE;
}

/** The scope a brand-new chat entry point (the sidebar's New Chat) binds:
 * the window's current folder when one exists, else the whole library. */
export function newChatScope(windowFolder: string): ChatScope {
  return windowFolder ? folderScope(windowFolder) : LIBRARY_SCOPE;
}

/** The scope the pill displays: the live session's binding once one is
 * connected, else the scope the next session would use. */
export function chatScopePill(options: {
  connectedScope: ChatScope | null;
  picked: ChatScope | undefined;
  windowFolder: string;
  memberPaths: readonly string[];
}): ChatScope {
  return options.connectedScope
    ?? nextSessionScope(options.picked, options.windowFolder, options.memberPaths);
}

/** Validate a server `scope-changed` payload (the session was rebound by
 * `create_project`) into a ChatScope. Only a folder rebind exists today;
 * anything malformed is ignored so a bad payload cannot corrupt the pill. */
export function scopeChangedScope(scope: unknown): ChatScope | null {
  if (!scope || typeof scope !== 'object') return null;
  const value = scope as { kind?: unknown; path?: unknown };
  if (value.kind !== 'folder' || typeof value.path !== 'string' || !value.path.trim()) return null;
  return folderScope(value.path);
}

/** The query parameters a scope rides on — the WS connect URL and every
 * session-history request. Folder scope stays the legacy `folder` param;
 * the library scope is an explicit `scope=library`. */
export function scopeRequestParams(scope: ChatScope): { folder?: string; scope?: 'library' } {
  return scope.kind === 'folder' ? { folder: scope.path } : { scope: 'library' };
}

/** True when `scope` is exactly what an unpicked tab would resolve to for
 * this window folder — i.e. there is nothing to follow or freeze. */
function scopeIsWindowDefault(scope: ChatScope, windowFolder: string): boolean {
  return windowFolder
    ? scope.kind === 'folder' && scope.path === windowFolder
    : scope.kind === 'library';
}

export type WindowFolderSwitchPlan = 'follow' | 'freeze' | 'keep';

/** What an existing tab does when the window's folder changes.
 *
 * - `'follow'` — an unbound, completely idle tab reconnects its next
 *   (still empty) session to the new window default.
 * - `'freeze'` — the tab would follow, but it holds unsent draft text or
 *   attachments: promote its connected scope to an explicit pick so the
 *   draft keeps the scope the user saw. Never reconnect.
 * - `'keep'` — everything else: content, a running turn, an explicit
 *   pick, or a resumed session keeps its binding untouched.
 */
export function windowFolderSwitchPlan(options: {
  connectedScope: ChatScope | null;
  picked: ChatScope | undefined;
  resumedSession: boolean;
  hasContent: boolean;
  turnActive: boolean;
  hasDraft: boolean;
  windowFolder: string;
}): WindowFolderSwitchPlan {
  const unbound = Boolean(options.windowFolder)
    && !options.picked
    && !options.resumedSession
    && !options.hasContent
    && !options.turnActive
    && options.connectedScope != null
    && !scopeIsWindowDefault(options.connectedScope, options.windowFolder);
  if (!unbound) return 'keep';
  return options.hasDraft ? 'freeze' : 'follow';
}

/** True when an unbound, still-empty, draft-free tab should follow a
 * window-folder switch by reconnecting its next session. */
export function shouldFollowWindowFolder(options: {
  connectedScope: ChatScope | null;
  picked: ChatScope | undefined;
  resumedSession: boolean;
  hasContent: boolean;
  turnActive: boolean;
  hasDraft: boolean;
  windowFolder: string;
}): boolean {
  return windowFolderSwitchPlan(options) === 'follow';
}

/** Whether a chat tab is COMPLETELY blank — reusable as the welcome tab
 * for a new scope. Blank requires: no transcript, no active turn, not
 * resumed, no picked scope override, no draft text, and no attachments.
 * A tab with any of those is user work and must never be rebound. */
export function isBlankChatTab(options: {
  hasContent: boolean;
  turnActive: boolean;
  resumedSession: boolean;
  picked: ChatScope | undefined;
  hasDraftText: boolean;
  attachmentCount: number;
}): boolean {
  return !options.hasContent
    && !options.turnActive
    && !options.resumedSession
    && !options.picked
    && !options.hasDraftText
    && options.attachmentCount === 0;
}

/** Pick the blank tab to reuse as the welcome tab (New Chat button /
 * window-folder switch): prefer the preferred agent's blank tab, else any
 * blank tab, else null (create a new tab). */
export function blankTabToReuse(
  tabs: readonly { id: string; agent: string; blank?: boolean }[],
  preferredAgent: string,
): string | null {
  const blanks = tabs.filter((tab) => tab.blank);
  const preferred = blanks.find((tab) => tab.agent === preferredAgent);
  return (preferred ?? blanks[0])?.id ?? null;
}

/** What the sidebar's New Chat entry does for a requested agent: reuse
 * the one COMPLETELY blank tab regardless of its agent — switching the
 * blank tab's agent in place when it differs (`switchAgent`) — else
 * create a new tab. Any content, draft, attachments, or a resumed
 * session disqualifies a tab from reuse (that is the blank rule,
 * `isBlankChatTab`); user work is never rebound to another agent. */
export type NewChatPlan =
  | { kind: 'reuse'; id: string; switchAgent: boolean }
  | { kind: 'new' };

export function newChatPlan(
  tabs: readonly { id: string; agent: string; blank?: boolean }[],
  agent: string,
): NewChatPlan {
  const reuseId = blankTabToReuse(tabs, agent);
  if (!reuseId) return { kind: 'new' };
  const tab = tabs.find((candidate) => candidate.id === reuseId);
  return { kind: 'reuse', id: reuseId, switchAgent: tab?.agent !== agent };
}

/** Whether a newly entered window scope needs its one blank Chat entry.
 * Kept separate from Agent readiness: opening this surface must not install
 * a runtime until the user explicitly presses New Chat. */
export function shouldOpenInitialChatOnWindowEntry(
  booted: boolean,
  windowFolder: string,
  chatTabCount: number,
  previousWindowFolder: string | null,
): boolean {
  return chatTabCount === 0
    && previousWindowFolder !== windowFolder
    && (booted || Boolean(windowFolder));
}

/** What the chat panel does when the WINDOW's folder switches:
 * - the ACTIVE tab is already bound to the new folder → nothing. The
 *   conversation the user is looking at IS the working entry for that
 *   folder (create_project auto-select, or clicking back to a chat's own
 *   folder) — spawning a welcome tab over it would be hostile.
 * - a completely blank tab exists → activate it (it follows the window
 *   default on its next connect).
 * - otherwise → create a fresh welcome tab.
 */
export type SwitchWelcomeTabPlan =
  | { kind: 'none' }
  | { kind: 'activate'; id: string }
  | { kind: 'new' };

export function switchWelcomeTabPlan(
  tabs: readonly { id: string; agent: string; blank?: boolean; boundFolder?: string | null }[],
  activeTabId: string | null,
  newFolderPath: string,
  preferredAgent: string,
): SwitchWelcomeTabPlan {
  const active = activeTabId ? tabs.find((tab) => tab.id === activeTabId) : undefined;
  if (active && active.boundFolder === newFolderPath) return { kind: 'none' };
  const reuse = blankTabToReuse(tabs, preferredAgent);
  if (reuse) return { kind: 'activate', id: reuse };
  return { kind: 'new' };
}

/** The file listing that feeds `@` mentions and folder-file attachment
 * validation for a scope:
 * - window-folder scope → the window's own listing;
 * - another library folder → that folder's listing;
 * - library scope → mentions disabled (no single folder listing exists).
 */
export type MentionListingPlan =
  | { kind: 'window' }
  | { kind: 'folder'; root: string }
  | { kind: 'disabled' };

export function mentionListingPlan(scope: ChatScope, windowFolder: string): MentionListingPlan {
  if (scope.kind === 'library') return { kind: 'disabled' };
  if (windowFolder && scope.path !== windowFolder) return { kind: 'folder', root: scope.path };
  return { kind: 'window' };
}

/** Locked exactly like the model menu — a transcript (including a resumed
 * one) or an active turn means the conversation is bound to its scope. */
export function folderMenuLocked(hasTranscript: boolean, turnActive: boolean, resumedSession: boolean): boolean {
  return hasTranscript || turnActive || resumedSession;
}

export function folderDisplayName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.pop() || path;
}

/** Pill / header display name for a scope. The library scope is always
 * called "Library" in UI copy. */
export function scopeDisplayName(scope: ChatScope): string {
  return scope.kind === 'library' ? 'Library' : folderDisplayName(scope.path);
}


/** Shorten an absolute path for menu detail text: `/Users/foo/Notes` →
 * `~/Notes` when it lives under the user's home dir. */
export function shortenFolderPath(abs: string, homeDir: string): string {
  if (!homeDir) return abs;
  if (abs === homeDir) return '~';
  if (abs.startsWith(homeDir + '/')) return '~/' + abs.slice(homeDir.length + 1);
  return abs;
}

export function scopePillAriaLabel(scope: ChatScope, locked: boolean): string {
  const base = scope.kind === 'library'
    ? 'Session scope: Library'
    : `Session folder: ${folderDisplayName(scope.path)}`;
  return locked ? `${base} — set for this conversation` : base;
}

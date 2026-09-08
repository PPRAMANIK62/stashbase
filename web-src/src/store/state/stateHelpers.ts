/**
 * Pure renderer state transition helpers shared by action hooks and the reducer.
 * Runtime dependencies stay browser-safe and free of React side effects.
 */
import type { FileMeta } from '@/common/api/api';
import { isRetrievableViewerFormat } from '@shared/file-formats';
import { VIEWABLE_FILE_EXTENSION_ALTERNATION } from '@shared/file-formats';
import type { ChatSlice, ChatTab, NameSet, Tab, WorkspaceSlice } from './state';

const VIEWABLE_EXTENSION_RE = new RegExp(`\\.(${VIEWABLE_FILE_EXTENSION_ALTERNATION})$`, 'i');

/** Build a `NameSet` from any name iterable. `Object.fromEntries` defines own
 *  properties, so a name like `__proto__` becomes a real member instead of
 *  reassigning the prototype. */
export function toNameSet(names: Iterable<string>): NameSet {
  return Object.fromEntries(Array.from(names, (name) => [name, true] as const));
}

/** Membership test for a `NameSet`. Own-property only: plain indexing would
 *  report `constructor` / `toString` / `valueOf` as members. */
export function hasName(set: NameSet, name: string): boolean {
  return Object.hasOwn(set, name);
}

export function nameSetSize(set: NameSet): number {
  return Object.keys(set).length;
}

/** Sidebar side-panel resize bounds (px), shared by the reducer and the
 *  drag handle. Dragging the panel narrower than `COLLAPSE_AT` collapses
 *  it entirely; between that and `MIN` it snaps to `MIN`. */
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 520;
export const SIDEBAR_COLLAPSE_AT = 100;

/** Chat-panel resize bounds (px), shared by the reducer and drag handle.
 *  The floor fits the composer bar's worst case — attach + scope pill +
 *  model pill + mode pill + send — with the pills already truncating;
 *  below ~320 the bar clips its terminal send button. */
export const CHAT_MIN_WIDTH = 320;
export const CHAT_MAX_WIDTH = 640;
export const SPLITTER_KEYBOARD_STEP = 16;

export type SplitterKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';
const SPLITTER_KEYS: readonly SplitterKey[] = [
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
];

export function isSplitterKey(key: string): key is SplitterKey {
  return (SPLITTER_KEYS as readonly string[]).includes(key);
}

export function clampChatWidth(width: number) {
  return Math.max(CHAT_MIN_WIDTH, Math.min(width, CHAT_MAX_WIDTH));
}

/** Platform-neutral keyboard transition for the left sidebar separator. */
export function resizeSidebarByKeyboard(
  width: number,
  collapsed: boolean,
  key: SplitterKey,
): { width: number; collapsed: boolean } {
  if (key === 'Home') return { width, collapsed: true };
  if (key === 'End') return { width: SIDEBAR_MAX_WIDTH, collapsed: false };
  if (key === 'ArrowRight') {
    return {
      width: collapsed
        ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(width, SIDEBAR_MAX_WIDTH))
        : Math.min(width + SPLITTER_KEYBOARD_STEP, SIDEBAR_MAX_WIDTH),
      collapsed: false,
    };
  }
  if (collapsed) return { width, collapsed: true };
  if (width <= SIDEBAR_MIN_WIDTH) return { width, collapsed: true };
  return {
    width: Math.max(width - SPLITTER_KEYBOARD_STEP, SIDEBAR_MIN_WIDTH),
    collapsed: false,
  };
}

/** Keyboard movement follows the separator: left grows the right-hand pane. */
export function resizeChatByKeyboard(width: number, key: SplitterKey): number {
  if (key === 'Home') return CHAT_MIN_WIDTH;
  if (key === 'End') return CHAT_MAX_WIDTH;
  return clampChatWidth(
    width + (key === 'ArrowLeft' ? SPLITTER_KEYBOARD_STEP : -SPLITTER_KEYBOARD_STEP),
  );
}

/** Sidebar Document Outline dock bounds (px). The dock is the outline's
 *  header strip plus its list; its height is what the drag handle on the
 *  tree/outline seam sizes. The floor keeps three 23px outline rows under
 *  the 26px strip. There is no static ceiling: the dock may take every row
 *  the file tree can spare, and what bounds it is the tree's own floor —
 *  its 28px header plus four rows while the tree is unfolded, the header
 *  alone once it is folded. The handle measures that ceiling from live
 *  geometry; the reducer clamps only the floor. */
export const OUTLINE_MIN_HEIGHT = 95;
export const FILE_TREE_MIN_HEIGHT = 120;

/** The outline handle is a horizontal separator, so it answers the
 *  vertical arrows — `isSplitterKey` stays the guard for the two column
 *  handles and their horizontal arrows. */
export type OutlineSplitterKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
const OUTLINE_SPLITTER_KEYS: readonly OutlineSplitterKey[] = [
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

export function isOutlineSplitterKey(key: string): key is OutlineSplitterKey {
  return (OUTLINE_SPLITTER_KEYS as readonly string[]).includes(key);
}

/** `ceiling` is the live bound the tree leaves (see `OUTLINE_MIN_HEIGHT`).
 *  A ceiling under the floor — a window too short for both floors — yields
 *  the floor; the dock's flex layout clips from there. */
export function clampOutlineHeight(height: number, ceiling: number): number {
  return Math.max(OUTLINE_MIN_HEIGHT, Math.min(height, ceiling));
}

/** Up grows the outline (the seam moves up), Down shrinks it; Home parks
 *  it on its floor and End on the ceiling the tree currently leaves. */
export function resizeOutlineByKeyboard(
  height: number,
  ceiling: number,
  key: OutlineSplitterKey,
): number {
  if (key === 'Home') return OUTLINE_MIN_HEIGHT;
  if (key === 'End') return clampOutlineHeight(ceiling, ceiling);
  return clampOutlineHeight(
    height + (key === 'ArrowUp' ? SPLITTER_KEYBOARD_STEP : -SPLITTER_KEYBOARD_STEP),
    ceiling,
  );
}

/** Build a fresh persistent tab. The id is `crypto.randomUUID` because every
 *  browser shipping in 2024+ (and Electron's bundled Chromium) has it;
 *  Node ≥19 also exposes it. */
export function makeTab(): Tab {
  return {
    id: crypto.randomUUID(),
    file: null,
    editMode: false,
    dirty: false,
    pendingAnchor: null,
    pendingHighlight: null,
    saveStatus: { text: '', cls: '' },
  };
}

/** Resolve the active tab object, or null if none. Used by both the
 *  reducer and the action thunks. */
export function getActiveTab(w: WorkspaceSlice): Tab | null {
  if (w.activeTabId == null) return null;
  return w.tabs.find((t) => t.id === w.activeTabId) ?? null;
}

/** Create a numbered placeholder tab for a new agent conversation. A new
 *  tab starts completely blank (its AgentView keeps the flag current).
 *  "New Chat" — not "Untitled" — matches the chat mental model; the first
 *  turn replaces it with the session's derived title. */
export function makeChatTab(agent: string, tabs: ChatTab[]): ChatTab {
  const sameAgentTabs = tabs.filter((tab) => tab.agent === agent);
  return {
    id: crypto.randomUUID(),
    agent,
    title: placeholderChatTitle(sameAgentTabs.length),
    blank: true,
  };
}

/** The placeholder title `makeChatTab` hands a fresh tab: `"New Chat"`, or
 *  `"New Chat N"` once the agent already owns tabs. */
function placeholderChatTitle(sameAgentTabs: number): string {
  return sameAgentTabs === 0 ? 'New Chat' : `New Chat ${sameAgentTabs + 1}`;
}

/** Matches a title that is still `makeChatTab`'s untouched placeholder — a
 *  session-derived or user-set title never does. */
const PLACEHOLDER_CHAT_TITLE_RE = /^New Chat( \d+)?$/;

/**
 * The title a blank tab takes when it switches agent in place
 * (`CHAT_TAB_SET_AGENT`). Renumbering is UI copy formatting, so it lives
 * beside `makeChatTab` — the two must agree on the per-agent numbering — and
 * not inside the reducer. A non-placeholder title is preserved untouched.
 */
export function retitledForAgentSwitch(title: string, sameAgentTabs: number): string {
  return PLACEHOLDER_CHAT_TITLE_RE.test(title.trim())
    ? placeholderChatTitle(sameAgentTabs)
    : title;
}

/** Move a chat tab to the most-recent position for its agent. */
function rememberChatTab(recency: ChatSlice['chatTabRecencyByAgent'], tab: ChatTab): ChatSlice['chatTabRecencyByAgent'] {
  return {
    ...recency,
    [tab.agent]: [...(recency[tab.agent] ?? []).filter((id) => id !== tab.id), tab.id],
  };
}

/** Drop a closed tab from its agent's recency list. */
function forgetChatTab(recency: ChatSlice['chatTabRecencyByAgent'], tab: ChatTab): ChatSlice['chatTabRecencyByAgent'] {
  const ids = (recency[tab.agent] ?? []).filter((id) => id !== tab.id);
  if (ids.length > 0) return { ...recency, [tab.agent]: ids };
  const { [tab.agent]: _removed, ...rest } = recency;
  return rest;
}

/** The ONE way `chatTabRecencyByAgent` changes. Every reducer case that opens,
 *  creates, activates, closes, or re-agents a chat tab states its intent here
 *  instead of hand-rolling the index:
 *
 *  - `forget` drops a tab from the agent bucket it currently sits in (a close,
 *    or the old agent when a blank tab switches agents);
 *  - `remember` moves a tab to the most-recent slot of the agent it now
 *    belongs to.
 *
 *  `forget` is always applied first, so passing the same tab under both keys
 *  is exactly the bucket move `CHAT_TAB_SET_AGENT` needs. Omitted keys are
 *  no-ops, so a case that only activates a tab passes only `remember`. */
export function updateChatTabRecency(
  recency: ChatSlice['chatTabRecencyByAgent'],
  change: { forget?: ChatTab | null; remember?: ChatTab | null },
): ChatSlice['chatTabRecencyByAgent'] {
  const forgotten = change.forget ? forgetChatTab(recency, change.forget) : recency;
  return change.remember ? rememberChatTab(forgotten, change.remember) : forgotten;
}

/** Return an agent's most recently active tab that is still open. */
export function mostRecentChatTab(c: ChatSlice, agent: string): ChatTab | null {
  const ids = c.chatTabRecencyByAgent[agent] ?? [];
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const tab = c.chatTabs.find((candidate) => candidate.id === ids[i]);
    if (tab) return tab;
  }
  return null;
}

/** Put a source file first in its folder-local most-recently-used list. */
export function rememberRecentFile(paths: string[], path: string): string[] {
  return [path, ...paths.filter((candidate) => candidate !== path)];
}

/** Put a tab id first in Editor History's most-recently-activated list. */
export function rememberActivatedTab(history: string[], id: string): string[] {
  return [id, ...history.filter((candidate) => candidate !== id)];
}

/** Drop closed tab ids from Editor History so the Ctrl+Tab navigator never
 *  offers a tab that no longer exists. */
export function forgetClosedTabs(history: string[], openIds: Set<string>): string[] {
  return history.filter((id) => openIds.has(id));
}

/** Visible files to mark as pending immediately after the user adds the
 *  first embedding key. The server may already be embedding by the time
 *  `/api/index-status` is polled, and the daemon serialises status behind
 *  embeds; this optimistic set keeps search-readiness accounting from
 *  temporarily undercounting the backfill. */
export function optimisticKeyBackfillPaths(files: FileMeta[]): string[] {
  return files
    // The shared predicate, not a per-format enumeration: the list form is
    // what let a newly added format be forgotten here.
    .filter((f) => isRetrievableViewerFormat(f.format))
    .map((f) => f.name)
    .filter((name) => !name.split('/').some((seg) => seg.startsWith('.')))
    .sort();
}

/** Merge `patch` into the active tab in place. Returns the state
 *  unchanged when no tab is active — every caller checks `activeTabId`
 *  first, but the no-op guard keeps the reducer cases short. */
export function patchActiveTab(w: WorkspaceSlice, patch: Partial<Tab>): WorkspaceSlice {
  if (w.activeTabId == null) return w;
  return {
    ...w,
    tabs: w.tabs.map((t) => (t.id === w.activeTabId ? { ...t, ...patch } : t)),
  };
}

export function remapOnePath(path: string, from: string, to: string, kind: 'file' | 'folder'): string {
  if (!path) return path;
  if (kind === 'file') return path === from ? to : path;
  if (path === from) return to;
  return path.startsWith(from + '/') ? to + path.slice(from.length) : path;
}

function splitPath(path: string): { parent: string; base: string } {
  const i = path.lastIndexOf('/');
  return i < 0 ? { parent: '', base: path } : { parent: path.slice(0, i), base: path.slice(i + 1) };
}

export function renamedFilePath(oldName: string, newBaseName: string): string {
  const extMatch = oldName.match(VIEWABLE_EXTENSION_RE);
  const base = splitPath(oldName).base;
  const lastDot = base.lastIndexOf('.');
  const ext = extMatch ? extMatch[0] : lastDot > 0 ? base.slice(lastDot) : '';
  const lastSlash = oldName.lastIndexOf('/');
  const dir = lastSlash >= 0 ? oldName.slice(0, lastSlash + 1) : '';
  return dir + newBaseName + ext;
}

function uniqueOrder(names: string[]): string[] {
  return [...new Set(names)];
}

export function remapFileOrder(
  order: Record<string, string[]>,
  from: string,
  to: string,
  kind: 'file' | 'folder',
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [parent, names] of Object.entries(order)) {
    const remappedParent = kind === 'folder' ? remapOnePath(parent, from, to, kind) : parent;
    next[remappedParent] = uniqueOrder([...(next[remappedParent] ?? []), ...names]);
  }

  const oldPart = splitPath(from);
  const newPart = splitPath(to);
  const oldList = next[oldPart.parent] ?? [];
  if (oldList.includes(oldPart.base)) {
    if (oldPart.parent === newPart.parent) {
      next[oldPart.parent] = uniqueOrder(oldList.map((name) => (
        name === oldPart.base ? newPart.base : name
      )));
    } else {
      next[oldPart.parent] = oldList.filter((name) => name !== oldPart.base);
      next[newPart.parent] = uniqueOrder([...(next[newPart.parent] ?? []), newPart.base]);
    }
  }

  for (const [parent, names] of Object.entries(next)) {
    if (names.length === 0) delete next[parent];
  }
  return next;
}

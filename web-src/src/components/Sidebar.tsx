import {
  ChevronDownIcon,
  CubeLogoIcon,
  FolderIcon,
  MoreHorizontalIcon,
  NewFileIcon,
  OutlineIcon,
  PlusIcon,
  StarIcon,
} from '../icons';
import { SidebarAccountRow } from './SidebarAccountRow';
import { useApp } from '../store/AppContext';
import { folderScope } from './agent/folderState';
import { ALL_HISTORY_SCOPE } from './agent/sessionHistory';
import { AGENT_META, AGENTS, type AgentKind } from '../agentCatalog';
import {
  newChatAgentSelectionPlan,
  readPreferredAgent,
  rememberPreferredAgent,
} from '../agentPreference';
import { electronBridge } from '../electronBridge';
import { folderRefsEqual } from '../folderPath';
import { basename, shortenFolderPath } from '../lib/paths';
import { FileTree } from './FileTree';
import { useDocumentOutline } from './DocumentOutlineContext';
import { LazyLoadBoundary, lazyWithRetry } from './ErrorBoundary';
import { FolderMenu } from './FolderMenu';
import { Menu, type MenuItem } from './Menu';
import { RemoveFolderModal } from './RemoveFolderModal';
import { activateChatTabForAgent, ScopeHistoryButton } from './ScopeHistoryButton';
import { Button } from './ui/button';
import { api, errorMessage } from '../api';
import { FILE_MIME } from '../dragMime';
import { useFolderRemoval } from '../hooks/useFolderRemoval';
import { refreshLibraryMembership } from '../hooks/useLibraryMembership';
import { useLibraryReconcile } from '../hooks/useLibraryReconcile';
import { Suspense, useCallback, useEffect, useRef, useState, type DragEvent } from 'react';

/** The chat-activation rule lives beside the History resume path in
 *  `ScopeHistoryButton.tsx`; re-exported here because the titlebar chat
 *  toggle imports it from this module. */
export { activateChatTabForAgent } from './ScopeHistoryButton';

const DocumentOutline = lazyWithRetry(() =>
  import('./DocumentOutline').then((mod) => ({ default: mod.DocumentOutline })));
const SemanticIndexingNotice = lazyWithRetry(() =>
  import('./SemanticIndexingNotice').then((mod) => ({ default: mod.SemanticIndexingNotice })));
const EmbeddingSetupCallout = lazyWithRetry(() => import('./EmbeddingSetupCallout'));
const UnsupportedFilesCallout = lazyWithRetry(() => import('./UnsupportedFilesCallout'));

/**
 * The sidebar is one Files panel — the active folder's file tree — with
 * no activity rail: the sidebar toggle, search, and the library folder
 * switcher live in the shell's titlebar controls (`TitlebarControls.tsx`),
 * search itself in the library search popup (`ManagedLibrarySearch.tsx`),
 * and the account (with Settings beside it) in the panel's bottom row.
 */
export function Sidebar() {
  return (
    /* Explicit h-full so the inner file list (flex-1) knows how much to
     * grow into; overflow-hidden clips content as the grid column
     * resizes / collapses to zero width — without it, file names
     * visually spill into the main pane mid-transition.
     * `group/sidebar` drives the hover-reveal of the header action
     * icons (see the side-actions class strings below). */
    <aside className="sidebar group/sidebar relative flex h-full min-h-0 min-w-0 flex-row overflow-hidden border-r border-border bg-pane">
      {/* macOS Electron only (display:none elsewhere): the quiet band at
        * the column's top that the traffic lights float over, doubling as
        * the window drag region now that there is no titlebar strip.
        * Structural rules live in globals.css (Electron chrome
        * exemption) — `-webkit-app-region` needs a real element. */}
      <div className="sidebar-drag-zone" aria-hidden="true" />
      {/* `sidebar-panel` carries the titlebar clearance (globals.css). */}
      <div className="sidebar-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <FilesPanel />
      </div>
    </aside>
  );
}

/* Header action icons stay invisible until the pointer is over the
 * sidebar, mirroring VS Code's quiet explorer toolbar. */
const sideActionsClass =
  'flex gap-0.5 opacity-0 transition-opacity duration-fast group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100';

/* Section header toggle: a quiet, normal-case label whose chevron sits in
 * the same 16px leading slot the pill rows use, so the header text lines
 * up with the row text gutter below it. Rotation lives on the chevron slot
 * (not `[&_svg]` on the button) so other glyphs in the header stay put —
 * callers rotate the slot from the same state that drives aria-expanded. */
const sectionToggleClass =
  'inline-flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left '
  + 'text-muted-foreground hover:text-foreground focus-visible:text-foreground';

/* text-base — the SAME size as the rows: with the app-wide icons beside
 * them, a smaller label reads shrunken rather than subordinate. Regular
 * weight, not medium: these labels sit on their own tinted strip, and
 * that band already says "header" — adding weight on top only made the
 * bottom dock's three lines the heaviest ink in a quiet sidebar. */
const sectionTitleClass = 'min-w-0 truncate text-base text-muted-foreground';

/** The Explorer view. The active folder zone (current folder header +
 * file tree) and the active Markdown document outline share this one
 * sidebar as stacked sections; library membership lives in the titlebar's
 * folder switcher. */
function FilesPanel() {
  const { state, activeTab } = useApp();
  const { outline } = useDocumentOutline();
  const [outlineExpanded, setOutlineExpanded] = useState(true);

  const hasMarkdownDocument = activeTab?.file?.format === 'md';
  // Tri-state: `null` means the embedder has not been read yet, and only a
  // definite `false` should pull in the notice chunk. The card re-checks
  // before rendering; this just decides whether loading it can matter.
  const embeddingSetupPossible = state.embedderHasKey === false;
  // The outline block belongs to an OPEN DOCUMENT inside an open
  // folder. A bare workspace (chat only, nothing open) drops it, as
  // does a window with no folder — nothing there has an outline, and
  // the sections below should hold the eye instead.
  const showOutline = !!state.folderPath && !!activeTab?.file;

  // Switching to another document re-applies the outline's default:
  // expanded as soon as it actually HAS headings (they load async, so
  // the switch only marks the intent). A manual fold wins within the
  // current document — the same "transition resets the default" rule as
  // the Library's folder-presence effect. Keyed by file identity so an
  // in-place navigation refreshes the outline for the replacement file.
  const documentKey = hasMarkdownDocument && activeTab?.file
    ? `${activeTab.file.folder ?? ''}:${activeTab.file.name}`
    : null;
  const documentKeyRef = useRef(documentKey);
  const outlineDefaultPending = useRef(false);
  if (documentKeyRef.current !== documentKey) {
    documentKeyRef.current = documentKey;
    outlineDefaultPending.current = documentKey != null;
  }
  const hasHeadings = outline.headings.length > 0;
  useEffect(() => {
    if (outlineDefaultPending.current && hasHeadings) {
      outlineDefaultPending.current = false;
      setOutlineExpanded(true);
    }
  }, [documentKey, hasHeadings]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" id="sidebar-panel-files">
      <NewChatButton />
      {/* Explorer sections mirror VS Code's compact disclosure rows. The
        * folder zones and the active document's outline intentionally share
        * one navigation surface; neither becomes a floating editor
        * companion. */}
      <LibrarySections>
        {/* Shown for as long as SOME document is open (see
          * `showOutline`) — not just Markdown ones — so switching tabs
          * never shifts the sections below under the pointer; a file
          * that cannot have an outline says so in the empty note. It
          * carries the dock's mt-auto anchor; the dock reads outline →
          * Library → account, each a fixed block with a top hairline
          * (they sit flush, so whitespace cannot separate them here).
          * The expanded list is the Library treatment — a capped
          * internal scroller, not a growing section. */}
        {showOutline && (
        <section className="mt-auto flex flex-none flex-col overflow-hidden border-t border-border">
          {/* Same narrow tinted strip as the Library header below. */}
          <div className="group/outline flex min-h-[26px] items-center justify-between gap-1.5 bg-muted/45 pr-2 pl-3.5">
            <button type="button" className={sectionToggleClass} aria-expanded={outlineExpanded} aria-controls="sidebar-outline-section" onClick={() => setOutlineExpanded((expanded) => !expanded)}>
              {/* Same treatment as the Library header: glyph at rest,
                * fold chevron under the pointer. */}
              <span className="inline-flex size-4 flex-none items-center justify-center">
                <OutlineIcon className="size-3.5 group-hover/outline:hidden" />
                <span className={'hidden items-center justify-center transition-transform duration-fast group-hover/outline:inline-flex [&_svg]:size-3.5' + (outlineExpanded ? '' : ' -rotate-90')}><ChevronDownIcon /></span>
              </span>
              <span className={sectionTitleClass + ' flex-1'}>Document Outline</span>
            </button>
          </div>
          {/* FIXED height (VS Code's outline view), not a content cap:
            * an expanded outline is always the same block, so switching
            * between documents with different heading counts never
            * moves the Library rows below. Same 154px as the Library
            * list's cap — the two dock lists read as one rhythm. */}
          <div id="sidebar-outline-section" className={outlineExpanded ? 'flex h-[154px] min-h-0 flex-col overflow-hidden' : 'hidden'}>
            {hasHeadings ? (
              <LazyLoadBoundary
                className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground"
                label="document outline"
                resetKey={activeTab?.id ?? 'none'}
              >
                <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">Opening outline…</div>}>
                  <DocumentOutline headings={outline.headings} activeId={outline.activeId} onSelect={outline.onSelect} />
                </Suspense>
              </LazyLoadBoundary>
            ) : (
              /* Inline, so a permanently-visible empty block never pulls
                * in the lazy outline chunk — that loads only once a real
                * outline exists. ml-[38px] is the shared label gutter. */
              <p className="my-1 mr-3 ml-[38px] text-sm text-muted-foreground">
                {hasMarkdownDocument ? 'No headings' : 'No outline for this file'}
              </p>
            )}
          </div>
        </section>
        )}
      </LibrarySections>
      {/* AI Index authorization is APP-WIDE, not a property of the
        * open folder, so it sits in the bottom chrome above the account
        * row rather than inside the file tree. Wedged between a folder header
        * and its own files it read as a fact about those files, and it
        * pushed the tree — the thing the panel exists for — down the
        * screen for a secondary notice. */}
      {embeddingSetupPossible && (
        <Suspense fallback={null}>
          <EmbeddingSetupCallout />
        </Suspense>
      )}
      {/* No mt-auto here: a dock block above always carries the bottom
        * anchor, and this row simply sits under it. */}
      <SidebarAccountRow />
    </div>
  );
}

/** Full-width New Chat entry at the sidebar's top (Cursor's "New
 *  Agent" position) — the app's ONE chat-creation entry point, a split
 *  button. The main area starts a chat with the last-selected agent; the
 *  chevron at the row's right edge only chooses the agent the next main-area
 *  click will use. That click reuses the one completely blank tab regardless
 *  of its agent (switching the blank tab's agent in place when it differs —
 *  `newChatPlan`); any content, draft, attachments, or resumed session means
 *  a fresh tab instead. It opens the chat panel when hidden. The
 *  reused/created tab's scope resolves to the window default (current folder,
 *  else Library) on connect, so no scope needs to be threaded here. */
function NewChatButton() {
  const { state, dispatch } = useApp();
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const chevronRef = useRef<HTMLButtonElement | null>(null);

  function startChat(agent: AgentKind) {
    activateChatTabForAgent(state, dispatch, agent);
  }

  /** Picking from the chevron only updates the next-chat preference. Chat
   *  creation stays behind the main New Chat action. */
  function pickAgent(agent: AgentKind) {
    const plan = newChatAgentSelectionPlan(agent);
    rememberPreferredAgent(plan.preferredAgent);
    if (plan.startAgent) startChat(plan.startAgent);
    setMenuAnchor(null);
  }

  /* Agent NAMES, not "New <Agent> Chat": the row itself says New Chat and
   * now names its agent beside this chevron, so the menu is the picker
   * that changes that name — repeating the whole action per item read as
   * three ways to do the same thing. */
  const agentItems: MenuItem[] = AGENTS.map((agent) => ({
    label: agent.launcherLabel,
    icon: <agent.Icon />,
    onSelect: () => pickAgent(agent.id),
  }));

  // Read at render time, no state: the picker closes its menu after writing,
  // while the other rememberPreferredAgent call sites also dispatch a store
  // update, so this row re-renders with the latest app-wide preference.
  const preferred = AGENT_META[readPreferredAgent()];

  return (
    /* A quiet full-width pill row (Cursor's "New Agent" treatment), not a
     * boxed button — the sidebar's rows carry the hierarchy. The chevron
     * is a subtle affordance revealed on hover/focus (and while its menu
     * is open). There is no keyboard shortcut, so no hint is shown. */
    <div className="flex-none px-1.5 pt-2 pb-3">
      <div className="group/newchat flex min-h-7 w-full items-center rounded-md hover:bg-muted">
        <button
          type="button"
          className="flex min-h-7 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-base text-foreground"
          title={`Start a ${preferred.launcherLabel} chat in the current folder, or across the whole library`}
          onClick={() => startChat(readPreferredAgent())}
        >
          {/* A PLUS, not the agent's mark: this row's job is "make a new
            * chat", and leading with a vendor glyph made the action read
            * as "Codex" with a label attached. Which agent it will use
            * now rides beside the chevron, where the picker that changes
            * it lives. 16px slot around the 14px glyph — every row does
            * this, so the label lands on the shared 38px gutter line. */}
          <span className="inline-flex size-4 flex-none items-center justify-center">
            <PlusIcon className="size-3.5 text-muted-foreground" />
          </span>
          <span className="min-w-0 truncate">New Chat</span>
        </button>
        {/* The agent this row will start, named next to its picker — the
          * row would otherwise give no clue which of the two runs, and
          * the menu is where it changes. */}
        {/* No right margin: the chevron's own 20px box already holds the
          * glyph 2px off the text, and any more read as two unrelated
          * controls rather than one label-plus-picker. */}
        {/* ALL chat history lives on this row since the Library section
          * retired — with no per-folder rows left, this is the one place
          * every session (each member folder + the library scope) stays
          * reachable; rows resume in their own scope. It sits BEFORE the
          * agent label so the "Codex ⌄" label-plus-picker pair stays
          * adjacent. */}
        <ScopeHistoryButton
          scope={ALL_HISTORY_SCOPE}
          label="Chat history"
        />
        <span className="ml-1 shrink-0 truncate text-xs text-muted-foreground">
          {preferred.launcherLabel}
        </span>
        <button
          ref={chevronRef}
          type="button"
          className={
            /* Quiet-icon-button canon (TitlebarControls): muted hover
             * surface; the app-wide `:focus-visible` outline rule paints
             * the translucent halo, as on every hand-rolled sidebar
             * button. Compact size-5 keeps the control inside the row;
             * sub-24px keeps rounded-sm per the corner contract. */
            'mr-1 inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent '
            + 'text-muted-foreground hover:bg-muted hover:text-foreground '
            /* size-4, a step up from the sidebar's 14px glyphs: this
             * chevron sits beside 11px text rather than 13px row text,
             * so at 14px it read as a speck next to the word it opens. */
            + '[&_svg]:size-4 '
            /* Always visible (muted): the arrow IS the discoverability of
             * the agent menu — hover-only would hide the affordance. */
            + (menuAnchor ? 'bg-muted text-foreground' : '')
          }
          aria-label="Choose agent for new chat"
          aria-haspopup="menu"
          aria-expanded={!!menuAnchor}
          onClick={() => {
            if (menuAnchor) { setMenuAnchor(null); return; }
            const rect = chevronRef.current?.getBoundingClientRect();
            if (rect) setMenuAnchor(rect);
          }}
        >
          <ChevronDownIcon />
        </button>
      </div>
      {menuAnchor && (
        <Menu
          anchor={{ rect: menuAnchor, align: 'right' }}
          minWidth={210}
          items={agentItems}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </div>
  );
}

/** The active-folder header's ⋯ trigger (favorite / sync / new window /
 *  remove live in its FolderMenu). */
function RootMenuButton({
  name,
  menuOpen,
  onMenu,
}: {
  name: string;
  menuOpen: boolean;
  onMenu: (rect: DOMRect) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="shrink-0 text-muted-foreground aria-expanded:bg-active aria-expanded:text-foreground"
      aria-label={`More actions for ${name}`}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={(e) => {
        e.stopPropagation();
        onMenu(e.currentTarget.getBoundingClientRect());
      }}
    >
      <MoreHorizontalIcon className="size-3.5" />
    </Button>
  );
}

/** The sidebar's two folder zones.
 *
 *  ACTIVE ZONE — only when this window has a folder open: the current
 *  folder's header row (explorer toolbar, drop target, ⋯ menu) with its
 *  file tree beneath. It shares the sidebar's one pane surface — the
 *  inset pill rows, not a surface split, carry the hierarchy.
 *
 *  LIBRARY — every OTHER member folder as a single compact row: favorites
 *  (all of them) pinned first, then the rest in recents order. The list
 *  caps at a fixed height and scrolls internally — a half-row peek at the
 *  cap hints at the overflow. Clicking a row switches this window's folder
 *  in place — the clicked folder moves up into the active zone and the
 *  previous one drops back into the list.
 *
 *  `children` (the Document Outline section) slots BETWEEN the two: it
 *  belongs to the working context above, while Library stays the
 *  bottom-most global section. */
function LibrarySections({ children }: { children?: React.ReactNode }) {
  const { state, actions, dispatch } = useApp();
  // `children` is the Document Outline section (or false when no
  // Markdown document is open) — it decides which bottom block carries
  // the mt-auto anchor.
  const hasOutline = Boolean(children);
  const semanticNoticeVisible = Boolean(
    state.semanticIndexing
    && ['awaiting-decision', 'paused', 'partial-paused'].includes(state.semanticIndexing.state),
  );
  const unsupportedFilesVisible = Boolean(
    (state.unsupportedFiles?.sourceCode ?? 0) + (state.unsupportedFiles?.other ?? 0),
  );
  const { pendingRemoval, removing, requestRemoval, cancelRemoval, removeFolder } =
    useFolderRemoval(dispatch, actions.toast);
  const [folderMenu, setFolderMenu] = useState<{ path: string; name: string; rect: DOMRect } | null>(null);
  const bridge = electronBridge();

  const isCurrent = useCallback(
    (path: string) => !!state.folderPath && folderRefsEqual(state.folderPath, path),
    [state.folderPath],
  );

  const activePath = state.folderPath;

  // Background reconcile covers every non-current member — membership is
  // no longer rendered as rows, and recovery must not depend on what is
  // on screen, so this loop runs unconditionally.
  const otherRootPathsKey = state.recent
    .filter((entry) => !isCurrent(entry.path))
    .map((entry) => entry.path)
    .join('\n');

  // Optimistic star toggle: flip in the store immediately, persist in the
  // background, and re-sync from the server if the write fails.
  const toggleFavorite = useCallback((path: string) => {
    setFolderMenu(null);
    const entry = state.recent.find((r) => r.path === path);
    if (!entry) return;
    const favorite = !entry.favorite;
    dispatch({
      type: 'RECENT_LOADED',
      recent: state.recent.map((r) => (r.path === path ? { ...r, favorite } : r)),
      homeDir: state.homeDir,
    });
    void api.setFolderFavorite(path, favorite).catch((e) => {
      actions.toast(errorMessage(e), { level: 'error' });
      void refreshLibraryMembership(dispatch)
        .catch(() => { /* keep the optimistic flip until the next refresh */ });
    });
  }, [actions, dispatch, state.homeDir, state.recent]);

  const openRootInNewWindow = useCallback(async (path: string) => {
    setFolderMenu(null);
    const opened = await bridge?.openFolderWindow?.(path);
    if (!opened) {
      actions.toast('New window is only available in the desktop app.', { level: 'error' });
    }
  }, [actions, bridge]);

  useLibraryReconcile(true, otherRootPathsKey);

  const removeTarget = pendingRemoval
    ? removalDialogTarget(pendingRemoval, state.homeDir ?? '')
    : null;

  const menuEntry = folderMenu ? state.recent.find((r) => r.path === folderMenu.path) : null;
  const activeName = activePath ? basename(activePath) : '';
  const activeFavorite = !!activePath
    && !!state.recent.find((r) => folderRefsEqual(r.path, activePath))?.favorite;

  return (
    <>
      {activePath ? (
        /* ACTIVE ZONE — the window's current folder. It takes ALL the
         * room the bottom dock leaves (flex-1) and scrolls the tree
         * internally; a content-height cap would strand blank space
         * between the tree and the dock. Same quiet pane surface as the
         * rest of the sidebar — the pill rows carry the hierarchy, so no
         * hairline or surface split. */
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ActiveFolderHeader
            name={activeName}
            path={activePath}
            favorite={activeFavorite}
            menuOpen={folderMenu?.path === activePath}
            onMenu={(rect) => setFolderMenu({ path: activePath, name: activeName, rect })}
          />
          {/* Collapsing hides the list but leaves the `expanded` set in
            * state untouched, so re-expanding restores every inner
            * folder's prior open/closed state. */}
          {!state.folderCollapsed && (
            <div className="scrollbar-quiet min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
              {semanticNoticeVisible && (
                <Suspense fallback={null}>
                  <SemanticIndexingNotice />
                </Suspense>
              )}
              {unsupportedFilesVisible && (
                <Suspense fallback={null}>
                  <UnsupportedFilesCallout />
                </Suspense>
              )}
              <FileTree />
            </div>
          )}
        </section>
      ) : (
        /* NO-FOLDER ZONE — membership now lives in the titlebar's folder
         * switcher ("Library ⌄"), so this window state carries either the
         * zero-folder brand moment or a single quiet pointer at the
         * switcher. One anchor, no competing list (visual-style: empty
         * states name one deliberate anchor). */
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {state.recent.length === 0 ? <ZeroFolderState /> : (
            <p className="m-0 px-4 pt-5 text-sm leading-snug text-muted-foreground">
              Pick a folder from the Library menu in the top bar.
            </p>
          )}
        </section>
      )}
      {children}
      {folderMenu && (
        <FolderMenu
          rect={folderMenu.rect}
          isCurrent={isCurrent(folderMenu.path)}
          favorite={!!menuEntry?.favorite}
          canOpenInNewWindow={!!bridge?.openFolderWindow}
          onToggleFavorite={() => toggleFavorite(folderMenu.path)}
          onOpenInNewWindow={() => { void openRootInNewWindow(folderMenu.path); }}
          onRemove={() => requestRemoval(folderMenu.path)}
          onClose={() => setFolderMenu(null)}
        />
      )}
      {removeTarget && (
        <RemoveFolderModal
          name={removeTarget.name}
          path={removeTarget.path}
          parentLabel={removeTarget.parent}
          removing={removing}
          onCancel={cancelRemoval}
          onConfirm={() => removeFolder(removeTarget.path)}
        />
      )}
    </>
  );
}

/** What the remove-folder confirm modal names: the folder plus its
 *  shortened parent ("~/Projects"), so the dialog can say where the
 *  folder keeps living on disk after it leaves the library. */
function removalDialogTarget(
  path: string,
  homeDir: string,
): { path: string; name: string; parent: string } {
  const segs = path.split('/').filter(Boolean);
  segs.pop();
  const parent = shortenFolderPath(segs.length ? '/' + segs.join('/') : '/', homeDir);
  return { path, name: basename(path), parent };
}

/** The active zone's header row — the window's current folder. Carries the
 *  classic explorer toolbar (new note / new folder / sync / fold) plus the
 *  same ⋯ folder menu as the library rows. The `#sideHead` id and
 *  `drop-target` state class stay CSS-driven: `useGlobalDragDrop` toggles
 *  `drop-target` imperatively on #sideHead, sharing the tree's exempted
 *  drop styling (see sidebar.css). The header carries no persistent
 *  selected surface — its position above the tree already marks it as the
 *  current folder. */
function ActiveFolderHeader({
  name,
  path,
  favorite,
  menuOpen,
  onMenu,
}: {
  name: string;
  path: string;
  favorite: boolean;
  menuOpen: boolean;
  onMenu: (rect: DOMRect) => void;
}) {
  const { state, actions, dispatch } = useApp();
  const [sideHeadDrop, setSideHeadDrop] = useState(false);
  // Chat-history menu open: hold the hover-revealed action cluster
  // visible while its popover (portalled outside the sidebar) is up.
  const [historyOpen, setHistoryOpen] = useState(false);

  function onSideHeadDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes(FILE_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    setSideHeadDrop(true);
  }
  function onSideHeadDragLeave() { setSideHeadDrop(false); }
  function onSideHeadDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setSideHeadDrop(false);
    const internal = e.dataTransfer.getData(FILE_MIME);
    if (internal) {
      void actions.moveFile(internal, '');
    }
    // External imports are handled by the global drop listener which
    // computes its target from the cursor's `.tree-row.folder` /
    // `#sideHead` closest. We don't double-handle here.
  }

  return (
    <div
      id="sideHead"
      className={
        /* pr-0.5 (not pr-1): with the row's mx-1.5 that lands the action
         * cluster on the same 8px right inset as the Library header and
         * its rows, so every action icon in the sidebar shares one
         * column. */
        'side-head group/head mx-1.5 flex min-h-7 flex-none items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 hover:bg-muted'
        + (sideHeadDrop ? ' drop-target' : '')
      }
      onDragOver={onSideHeadDragOver}
      onDragLeave={onSideHeadDragLeave}
      onDrop={onSideHeadDrop}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 text-foreground">
        {/* Folder glyph at rest; the pointer swaps in the fold chevron so
          * the collapse affordance appears only when it's actionable. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-4 flex-none rounded-sm p-0 text-muted-foreground hover:bg-transparent"
          aria-label={`${state.folderCollapsed ? 'Expand' : 'Collapse'} files in ${name}`}
          aria-expanded={!state.folderCollapsed}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'FOLDER_FOLD_TOGGLE' }); }}
        >
          <FolderIcon className="size-3.5 group-hover/head:hidden" />
          <span className={'hidden items-center justify-center transition-transform duration-fast group-hover/head:inline-flex [&_svg]:size-3.5' + (state.folderCollapsed ? ' -rotate-90' : '')}><ChevronDownIcon /></span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 shrink justify-start truncate p-0 text-left text-base font-medium text-foreground hover:bg-transparent hover:text-foreground active:translate-y-0"
          aria-label={`Select ${name} folder root`}
          title={path}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ACTIVE_FOLDER', path: '' }); }}
        >{name}</Button>
        {favorite && (
          <StarIcon className="size-3 shrink-0 fill-current text-muted-foreground" aria-label="Favorite" />
        )}
      </span>
      {/* Only the high-frequency actions stay on the row — new note,
        * history, and the ⋯ menu (which carries new-folder / sync /
        * fold-all for this folder). Six icons here crushed the name. */}
      <div className={menuOpen || historyOpen ? 'flex gap-0.5' : sideActionsClass}>
        <NewNoteButton />
        {/* This folder's chat sessions — history lives on the scope
          * headers, not in the chat pane. */}
        <ScopeHistoryButton
          scope={folderScope(path)}
          label={'Chat history in ' + name}
          onOpenChange={setHistoryOpen}
        />
        <RootMenuButton name={name} menuOpen={menuOpen} onMenu={onMenu} />
      </div>
    </div>
  );
}

/** Zero-folder library: the one place sidebar chrome is allowed a small
 *  brand-warmth moment (see visual-style's warmth budget) — the app mark,
 *  a single line of guidance, and the primary add-folder action. */
function ZeroFolderState() {
  const { actions } = useApp();
  const bridge = electronBridge();

  async function addFolder() {
    try {
      const picked = await bridge!.openFolderDialog!({
        title: 'Select folder',
        buttonLabel: 'Select folder',
        allowCreateDirectory: true,
      });
      if (picked) await actions.openFolder(picked);
    } catch (err) {
      actions.toast('Could not open the folder: ' + errorMessage(err), { level: 'error' });
    }
  }

  return (
    <div className="flex flex-col items-start gap-3 px-4 pt-5 pb-4">
      <div className="size-9 *:size-full"><CubeLogoIcon /></div>
      <p className="m-0 text-sm leading-snug text-muted-foreground">
        Add a folder to build your searchable library.
      </p>
      {typeof bridge?.openFolderDialog === 'function' && (
        <Button onClick={() => { void addFolder(); }}>Add Folder…</Button>
      )}
    </div>
  );
}

/** "+" icon in the sidebar header that creates a new Markdown note in
 *  the active folder. HTML notes were dropped once their editor went
 *  away, so there's no format picker — one click, one .md draft. */
function NewNoteButton() {
  const { state, actions } = useApp();
  const target = state.activeFolder || state.folder || 'folder root';

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground"
      title={'New note in ' + target}
      aria-label={'New note in ' + target}
      onClick={() => void actions.newNote()}
    ><NewFileIcon className="size-3.5" /></Button>
  );
}

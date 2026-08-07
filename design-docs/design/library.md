# Local File Workspace

StashBase is a workspace for ordinary local folders. It should make existing
files easier to work with and easier to hand to an Agent without asking users
to migrate them into a StashBase-specific storage model.

## Current

- Users can add, create, open, and remove local folders from the library.
- The app has no landing page: a window boots straight into the workspace
  with no folder selected, showing the chat panel on one blank
  library-scoped chat (the New Chat default). Browsing a folder is always
  an explicit sidebar click; only an explicit open request (such as Open
  in New Window) or a same-window reload restores a folder. An empty
  library shows a small zero-folder block in the sidebar with the app
  mark, one line of guidance, and an Add Folder action.
- The sidebar folder list refreshes itself while visible (a lightweight
  membership poll), so a project created by an agent in another window or
  by an external MCP client appears without any user action.
- A full-width New Chat split button sits at the top of the sidebar,
  above the Library section — the app's one chat-creation entry point.
  Its main area starts a chat with the last-selected Agent; a subtle
  chevron at the row's right edge offers New Claude Code Chat / New
  Codex Chat, and picking one also makes that Agent the new default. The
  chat is scoped to the window's current folder, or to the whole library
  when no folder is current, and a completely blank chat is reused
  (switching its Agent in place when needed) instead of stacking empty
  tabs. New Chat also reopens a hidden chat panel.
- The sidebar splits folder navigation into two zones separated by a
  hairline and a surface shift. When a folder is open, an active zone under
  the New Chat button shows that folder's header row (explorer toolbar,
  drop target, ⋯ menu) with its file tree beneath, on the base surface.
  Below it, the Library section lists every other member folder as a single
  compact row on the pane surface — favorites (all of them) pinned first,
  then the rest in recents order. While a folder is active the list caps at
  a fixed height (about five rows, with a half-row peek hinting at the
  overflow) and scrolls internally; with no folder open the Library is the
  panel's main content and fills the available space. Clicking a row
  switches this window's folder in place: the clicked folder moves up into
  the active zone and the previous one drops back into the list. Switching
  resets the folder-scoped document tabs and search state, but keeps the
  window's chat tabs and their running Agent sessions — each chat is pinned
  to its own scope (a library folder, or the whole library) — and surfaces
  a welcome chat for the new folder without disturbing any started chat or
  unsent draft. Visible library rows show a subtle warning dot when files
  in that folder could not be prepared for search.
- A `+` button in the Library header offers Open Folder… (any folder on
  disk, indexed in place) and New Folder… (created under the default
  StashBase location) through the native picker; a folder row's actions
  menu offers favorite toggling, Open in New Window, and Remove from
  Library. Users can star folders as Favorites; favorites are library
  metadata stored with the membership list, and starring never touches
  the folder on disk. New Folder creates a plain directory with no chat
  association.
- The built-in Agent can also add a project: `create_project` (an MCP tool)
  creates a folder — under the default StashBase location unless the user
  names a valid location inside the folder home or a library folder — and
  registers it into the library, so it appears in every window's sidebar
  list immediately. Only the window owning the calling chat switches its
  browse location to the new project; and only a library-scoped chat moves
  its own binding there (see [Agent Panel](agent-panel.md)).
- Each window centres on one current folder, with its own file tree, document
  tabs, search state, and Agent panel.
- Users can open multiple windows from the application menu or a folder action
  to keep different folders or working contexts visible side by side. A folder
  action focuses an existing matching window when one is already available.
- Window keyboard behavior follows VS Code: Cmd/Ctrl+Shift+N opens a window;
  macOS uses Cmd+Shift+W to close one, while Windows and Linux use Alt+F4 with
  Ctrl+Shift+W as an alternative. Cmd/Ctrl+W remains the active-tab command.
- Users can create, rename, move, and delete files or folders through explicit
  file operations.
- A folder opens into a chat-first workspace with the Files sidebar still
  visible. Selecting or creating a document reveals the source pane and docks
  the same conversation beside it.
- The main pane opens the source file the user selected; generated artifacts
  stay hidden.
- Cmd/Ctrl+T opens a new blank tab, the keyboard equivalent of the tab
  strip's `+` button — distinct from Cmd/Ctrl+N, which creates a note file.
- Cmd/Ctrl+O opens a focused Quick Open for visible source files in the active
  folder. It starts with recently used editors, then ranks basename and
  relative-path matches; accepting a result retains normal preview-tab and
  unsaved-work protections. Typing `>` switches that same picker to safe app
  commands; Cmd/Ctrl+Shift+P and F1 open that command mode directly.
- Holding Ctrl and tapping Tab opens Editor History, a VS Code-style
  Alt-Tab switcher over open tabs ordered by most-recent use, independent of
  tab-strip order. A quick tap-release switches straight to the previous
  editor without ever showing the picker; only a deliberate hold (or a
  second Tab tap) reveals it. Once revealed, tapping Tab while Ctrl stays
  down cycles the highlighted entry (Shift reverses); releasing Ctrl
  activates it. Escape cancels. Deliberately the literal Control key on
  every platform, including macOS, since Cmd+Tab is the OS application
  switcher.
- Search results and agent file links return users to those source files.
- Root-level `AGENTS.md` and optional `CLAUDE.md` bridge files are visible,
  editable user files. StashBase only creates missing defaults.

## Experience Contract

- Opening a folder should feel like navigation, not a long preparation task.
- Opening or closing one window must not switch or close another window's
  folder context.
- Window lifecycle shortcuts must not be interpreted as document-tab commands.
- Closing a window must either save the live edit first or leave the window
  open with a visible save failure.
- Opening a folder from one window must not create an avoidable duplicate when
  another window already owns that context.
- Users must be able to tell whether an operation affects source files or only
  StashBase-owned state.
- Removing a library folder removes derived state, never the user's folder.
- Removing a folder that is open elsewhere saves those windows and returns
  them to the no-folder workspace (the sidebar library list) instead of
  leaving stale editable state behind.
- Destructive file operations require clear confirmation.
- Blocking dialogs and menus keep keyboard focus inside the active surface,
  dismiss only the topmost eligible surface with Escape, and return focus to
  the invoking control. Pointer context menus first focus their file-tree row,
  so dismissal has the same deterministic return target. Non-blocking feedback
  is announced without stealing focus.
- Sidebar and Agent-panel widths work with pointer input and with
  Arrow/Home/End keys on macOS, Windows, and Linux; reduced-motion users do
  not receive layout movement animation.
- Closing the last document lets an open Chat reclaim the main area. Hiding
  Chat is explicit and stays hidden; the sidebar's New Chat button is the
  way back in.
- The Files sidebar is a calm orientation tool, not a separate knowledge graph
  or project-management surface. It stacks the active folder zone (current
  folder header and file tree), the Library folder list, and the active
  Markdown document outline as navigation sections; the Library and outline
  sections stay independently collapsible.
- Quick Open is file navigation, not content retrieval: it stays scoped to the
  active folder and does not surface generated artifacts or search evidence.
- Command Palette exposes only safe, context-available actions the app already
  supports. Its recency ordering lasts for the current session only; destructive
  and target-dependent operations keep their explicit flows and confirmations.

## Contribution Map

### Next

- Make loading, empty, and operation-failure states less ambiguous.
- Improve file-tree navigation and tab behaviour at large folder sizes.
- Make source versus derived state more legible without surfacing generated
  files.
- Improve file creation, rename, move, and attachment workflows.

### Coordinate First

- Folder membership, filesystem safety, deletion, or agent file permissions.
- Changes to what appears in the tree or what a search result opens.
- New workspace models, synchronization behaviour, or file storage layers.

### Not Planned

- A database-first or block-first knowledge base.
- Requiring users to copy files into a StashBase-managed workspace.
- A complex graph view as a primary navigation surface.

For Markdown-specific reading and writing, see [Markdown](markdown.md).

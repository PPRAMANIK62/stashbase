# Workspace

## User Outcome

People work directly in ordinary local folders, moving between files, Chat,
and windows without adopting a StashBase-specific storage model.

## Scope and Non-goals

This area owns library membership, folder navigation, the Files sidebar,
tabs, window behavior, and explicit source-file operations. Together with the
Documents area, it forms the Document Workbench. It does not own format
rendering, preparation correctness, retrieval ranking, or Agent session
protocols.

StashBase is not a database-first knowledge base, a block editor, a project
manager, or a primary graph-navigation tool.

## Current Experience

- Open documents sit in one horizontally scrolling tab strip, each tab
  naming its source and marking unsaved changes. A tab is a drag source for
  its file, which is how a document is handed to the Agent composer beside it.

- A window with no folder open shows the welcome screen. It offers the
  library's existing members, **Open folder**, **Create folder**, and **Import
  from GitHub…**, with the Gallery band below them under its own heading. The
  window never silently restores a folder, installs an Agent runtime, or opens
  account sign-in or setup for search by meaning.
- On first launch with a brand-new empty default folder home, StashBase seeds
  the ordinary local **👋 Start Here** folder and adds it to the library
  without automatically opening it. Its `00 Welcome.html` is the human entry;
  the remaining guides use a stable numbered order while the Agent-discovery
  file remains `AGENTS.md`. Detailed user-owned Markdown makes grounded
  product, workflow, capability, comparison, and recovery context available to
  Agent retrieval once that folder is open. An existing folder home is never
  modified,
  deleting the seeded folder does not recreate it, and application updates
  never overwrite the user's copy.
- The sidebar is the window's left column. It always carries the product mark
  and a footer of standing **Gallery**, **Settings**, and **Report a bug**
  rows. With a folder open it adds the active-folder picker and a navigator of
  four icon tabs, in order Files, Document outline, Search, and Chats. Files
  and Document outline share the scrolling tree region; Search and Chats take
  the whole column instead. The column resizes by dragging its inner edge and
  collapses by clicking the same edge.
- With no folder open the picker and the navigator are absent, so the bare
  sidebar is the mark and the footer. Browsing members, creating a folder, and
  importing a repository belong to the welcome screen there, and no folder is
  required to browse or download a Gallery entry.
- The **Gallery** row raises the shop as a near-fullscreen overlay over a
  folder window. It is the same shop the welcome screen carries as a band, and
  it never takes a chat tab. The entries and their downloads are the Gallery's
  own contract (see [Agent Panel](agent-panel.md)).
- The Document Outline is one of the navigator's tabs rather than a second
  dock beside the tree. A format that publishes no headings says so instead of
  reading as an outline that has not arrived yet.
- A strip between the titlebar and the workspace carries what the window has
  to say about work the reader did not ask for directly. Refusals come first
  and the one-time offer to set up search by meaning comes last, because a
  refusal of something attempted outranks an offer of something not asked for.
  With a folder open, a second strip below it offers the unsaved drafts a
  previous session left for that folder, which [Documents](documents.md) owns.
- Packaged builds check the official stable release channel on a schedule when
  the default-on preference permits it. The check and its installation
  authority belong to the desktop application rather than to any window.
- **Report a bug** is a standing sidebar row, disabled with a plain
  explanation when the desktop bridge is absent. The native Help menu carries
  the same report entry alongside the product website, the community Discord,
  and the external issue tracker.
- A signed-in account is recognizable inside Settings, in the section that
  owns search by meaning. It names the connected person and retains the full
  email, and missing profile display data falls back to a stable label without
  changing the controls beside it. **Sign in to StashBase** names the complete
  signed-out local-workspace state and its optional route to Wiki Agent and
  search by meaning.
- Users can open or create a local folder, import a public GitHub repository
  directly into the default folder home, switch folders in place, or remove a
  folder from the library. A created folder or imported repository is an
  ordinary directory, and removing membership clears only StashBase-owned
  state. A second window comes from the native File menu, and folder sync runs
  as part of ordinary refresh rather than as a per-member action.
- The sidebar's active-folder row keeps the window's folder identity visible
  and opens the full library membership, with pinned **Open folder**, **Create
  folder**, and **Import from GitHub…** actions beneath it. A member sharing a
  basename with another is qualified by its path so the two stay tellable
  apart, and the row shows an attention mark when preparation needs the user.
  A name wider than the sidebar column truncates within that column. The
  titlebar carries only the sidebar toggle and one shared slot holding either
  the open document tabs or the active Chat's title. Folder-level actions
  remain attributable to the active folder.
- Multiple windows share one library and runtime services while retaining
  independent active folders, tabs, search presentation, and Chat tabs.
- Folder switches reset folder-scoped documents but preserve library search
  state and scope-pinned chats. A blank welcome chat may follow the new folder;
  started work and unsent requests never silently rebind to another folder.
- Removing a member preserves Chat tabs. A completely blank Chat returns to
  Library scope without interruption. A Chat containing user work stays
  readable, says the folder was removed and the transcript is preserved, and
  reports how many queued messages were cancelled with it.
- The active folder tree truthfully reports ordinary source entries rather
  than filtering unknown formats. Generic files are muted with one stable
  explanation—Search and automatic Chat context do not consume them—and still
  open through Quick Open or their tree row. Ordinary user dotfiles remain
  visible, while dot-notes retain the established hidden-note namespace;
  exact app-derived artifacts, bundle resources, junk metadata, and
  dot-directories remain infrastructure rather than workspace content by
  default.
- The file tree's own context menu, on the empty space below the last row,
  offers a checkable **Show hidden files** action. It is an application-level
  preference. Every window applies the same durable value, and a missing or
  invalid stored value recovers to the safe default view. When enabled,
  eligible user-owned dot-directories such as `.github` and `.vscode` and
  their descendants join the tree and Quick Open with normal capability.
  Ordinary dotfiles are listed either way, so the option governs hidden
  directories rather than hidden files. VCS databases such as `.git`, StashBase-owned `.stashbase` and
  `.stashbase-*` state, other derived state, dot-notes,
  bundle resources, and junk metadata never surface in either mode, and
  hidden excluded caches keep their bounded non-expandable rows. Turning the
  option off removes hidden rows from the tree, keyboard order, selection,
  and Quick Open without closing open tabs. Visibility here is a Workbench
  choice only: hidden-directory content stays outside Preparation, indexing,
  Search, automatic Chat context, and Agent/MCP discovery.
- Dependency caches and generated build directories such as `node_modules`
  appear as non-expandable excluded-folder rows. StashBase does not recurse
  into them, so a project can explain their presence without paying the cost
  of rendering or indexing their contents. These rows are never presented as
  dead: row hover or keyboard focus reveals an external-action arrow whose
  delayed tooltip says **Show in Finder / File Explorer**. Row activation and
  the context menu provide the same system-file-manager exit.
- Files use the surface declared in the
  [Documents format matrix](documents.md#format-capability-matrix) and open in
  persistent tabs with Quick Open, history, and platform-appropriate
  shortcuts. Symlinks and special or unavailable entries
  are shown but never followed; their only file action is reveal.
- Search or Agent links to a file in another member folder open a read-only
  out-of-folder tab without switching the current folder. The user can open
  that folder in another window for full editing.
- File create, rename, import, and delete are explicit, and destructive
  operations confirm intent. Library-removal
  confirmation names the complete
  home-shortened member path that remains on disk. Runtime-native instruction
  files such as `AGENTS.md` and `CLAUDE.md` remain visible and user-owned;
  hidden tool infrastructure and derived data do not surface as workspace
  content.
- Durable guidance for StashBase Chats lives in the Agent panel's **Agent
  Instructions** editor as application metadata: each working folder edits its
  own, and Library-wide Chats edit one Library-scope guidance with its own
  packaged default oriented toward finding work and starting new projects.
  Opening a folder never creates, migrates, or edits instruction files in the
  user's source tree.

## Experience Contract

- Folder entry is navigation first; listing, preparation, and indexing continue
  in the background. Code-heavy project infrastructure that cannot surface in
  the Workbench does not make those background scans hold navigation closed.
  The switcher leaves its **Opening…** state when the local server confirms the
  window-folder binding; a delayed list, ordering read, preparation pass, or
  semantic reconcile cannot extend that state indefinitely.
- GitHub import accepts one public repository URL and one portable folder-home
  child name. Import fields remain locked while Git runs; cancellation leaves
  no partial published folder. A completed clone is retained and its local path
  stays actionable if the later folder-open transition fails.
- Closing a window either makes its live edit durable or leaves the window open
  with an actionable failure. Closing one window never tears down another.
- Folder removal never deletes user files. Every affected window saves first
  and leaves the removed folder, and recovery cannot silently re-add it.
  Unfinished indexing is retired without holding the confirmation or removal
  flow open. If retiring the shared index daemon interrupts work for another
  live member, that member resumes reconcile after the replacement is ready.
  Folder-loss and 412 recovery clear document/readiness state but never clear
  Chat tabs; the Agent lifecycle retires only sessions bound to the removed
  member.
  StashBase commits membership removal only after preparation, derived data,
  index rows, ordering, folder-scoped Agent Instructions, and folder-bound
  runtime state have finished cleanup.
- Folder membership and favorites never replace unreadable settings with
  fallback defaults. A durable library change fails instead, preserving the
  user's existing configuration for recovery.
- Source and derived state remain distinguishable. The tree and tabs show
  source files, not generated representations.
- Tree completeness is scoped to user workspace content: excluded directory
  placeholders explain intentionally untraversed infrastructure, while hidden
  product-derived artifacts never surface. A collapsed or excluded directory
  does not create descendant DOM. The hidden-files preference widens only
  Workbench visibility — retrieval, indexing, and Agent discovery scope are
  server-owned policies it never changes.
- Repeated or concurrent navigation to one source focuses its existing
  persistent tab. The same relative path in different Library folders remains
  a distinct source.
- Chat visibility is explicit after initialization. Closing the last document
  expands an open Chat; hiding Chat stays respected until the user reopens it.
- Keyboard focus, overlay dismissal, splitters, and reduced-motion behavior are
  consistent across supported platforms.
- Quick Open covers every file visible in the active tree and preserves the
  same muted retrieval explanation for generic files. It stays active-folder
  navigation and never becomes search, Agent permission, or hidden destructive
  automation.
- Update discovery is quiet, dismissible, and never blocks local work. One
  explicit Update action consents to download, installation, and relaunch;
  every open renderer
  crosses the normal save barrier before an installer may retire the
  application. Linux package installs may also require system administrator
  approval.

## Known Gaps

- Moving a file has no Workbench control. Create, rename, and delete are
  offered on a tree row; moving one is reachable only through Agent and MCP
  file tools, so the
  [Documents matrix](documents.md#format-capability-matrix)'s file-mutable
  capability is not complete in the Workbench.
- Document tabs cannot be reordered, and no control opens a new tab. The strip
  scrolls and each tab drags as its source instead.
- No window surfaces an available update. Packaged builds still check the
  release channel on schedule, but the dismissible announcement and the one
  explicit Update action the contract above requires have no control, so a
  discovered update reaches nobody and
  [J01](../user-journeys.md#j01-complete-onboarding-and-reach-first-value)'s
  return step cannot be completed in the app.
- Account identity is recognizable only inside Settings, in the section that
  owns search by meaning. The sidebar carries no identity and there is no
  account menu, so nothing in the workspace itself tells a signed-in person
  which account is connected.
- Favoriting a member and opening one in a second window from the library have
  no control. The membership row offers removal only.

## Cross-area Seams

- [Documents](documents.md) owns the surface inside a source tab.
- [Preparation](preparation.md) owns background derivation and readiness.
- [Search](search.md) owns cross-library evidence and out-of-folder result
  behavior.
- [Agent Panel](agent-panel.md) owns Chat tabs and scope-pinned sessions.
- Window retirement and file mutation details live in
  [Window Lifecycle](../../code-review/window-lifecycle.md) and
  [File Transactions](../../code-review/file-transactions.md).

## Contribution Direction

### Next

- Clarify loading, empty, and operation-failure states.
- Improve tree and tab behavior for large folders.
- Improve creation, rename, move, import, and attachment workflows.

### Coordinate First

- Folder membership, filesystem safety, deletion, or Agent file permissions.
- What appears in the tree or what a result opens.
- New workspace, synchronization, or storage models.

### Not Planned

- Requiring files to be copied into a managed workspace.
- Database-first or block-first source ownership.
- A graph view as the primary navigation surface.

## Related Journeys and Contracts

Journeys: [J01](../user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J02](../user-journeys.md#j02-add-and-open-a-folder),
[J03](../user-journeys.md#j03-read-and-edit-source-documents), and
[J13](../user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery). The core loop is
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work).
Cross-area
routes also include [J05](../user-journeys.md#j05-search-and-open-source-evidence)
and [J08](../user-journeys.md#j08-connect-an-external-agent-through-mcp).
Chat-first project entry is
[J11](../user-journeys.md#j11-turn-a-conversation-into-a-project). Folder-first
Wiki Page building is
[J12](../user-journeys.md#j12-build-wiki-pages-from-a-local-folder).

Contracts: [Architecture](../../code-review/architecture.md),
[Renderer Workspace](../../code-review/renderer-workspace.md),
[Window Lifecycle](../../code-review/window-lifecycle.md),
[File Transactions](../../code-review/file-transactions.md),
[Data Lifecycle](../../code-review/data-lifecycle.md), and
[Settings and Config](../../code-review/settings-config.md).

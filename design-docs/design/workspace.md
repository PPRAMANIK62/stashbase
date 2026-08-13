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

- A new window opens directly into the workspace with no folder selected and
  one expanded, reusable blank library Chat. It never silently restores a
  folder or installs an Agent runtime.
- The Files sidebar keeps New Chat at the top (with the all-sessions chat
  history beside it), the active folder and its tree in the main zone, and
  the account utilities at the bottom. A no-folder window shows the
  zero-folder card when the library is empty, or a quiet pointer at the
  titlebar switcher when members exist.
- Users can open or create a local folder, switch folders in place, favorite a
  member, open it in another window, sync it, or remove it from the library.
  A created folder is an ordinary directory. Removing membership clears only
  StashBase-owned state.
- The titlebar carries the folder switcher, right of the search control
  (workspace-switcher register): its trigger names the window's folder —
  "Library" with none open — so the identity survives a sidebar collapse.
  The menu lists the add-folder actions on top and the whole membership
  below (favorites first, the current folder checked, needs-attention
  members carrying a quiet dot). Selecting a member switches this window's
  folder in place. Favorite, sync, open-in-new-window, and removal act on
  the ACTIVE folder through its header's more-actions menu.
- Multiple windows share one library and runtime services while retaining
  independent active folders, tabs, search presentation, and Chat tabs.
- Folder switches reset folder-scoped documents but preserve library search
  state and scope-pinned chats. A blank welcome chat may follow the new folder;
  started work and unsent drafts never silently rebind.
- Supported files open in persistent tabs; format-owned session state may
  remain mounted while a tab is inactive (Markdown's bounded retention
  contract lives in [Documents](documents.md)). Quick Open, Command Palette,
  Editor History, tab shortcuts, and window shortcuts follow their documented
  platform behavior.
- Search or Agent links to a file in another member folder open a read-only
  out-of-folder tab without switching the current folder. The user can open
  that folder in another window for full editing.
- File create, rename, move, import, and delete are explicit. Destructive
  operations confirm intent. Root `AGENTS.md` and optional `CLAUDE.md` are
  visible, user-owned Markdown files that StashBase only creates when missing.
- Dot-directories are tool infrastructure and stay out of the tree, search,
  and index. Unsupported-file guidance explains why other files are hidden.

## Experience Contract

- Folder entry is navigation first; listing, preparation, and indexing continue
  in the background.
- Closing a window either makes its live edit durable or leaves the window open
  with an actionable failure. Closing one window never tears down another.
- Folder removal never deletes user files. Every affected window saves first,
  leaves the removed folder, and cannot silently re-add it during recovery.
- Source and derived state remain distinguishable. The tree and tabs show
  source files, not generated representations.
- Chat visibility is explicit after initialization. Closing the last document
  expands an open Chat; hiding Chat stays respected until the user reopens it.
- Keyboard focus, overlay dismissal, splitters, and reduced-motion behavior are
  consistent across supported platforms.
- Quick Open stays active-folder navigation. Command Palette exposes existing
  safe actions; neither surface becomes search, Agent permission, or hidden
  destructive automation.

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

Journeys: [J01](../user-journeys.md#j01-launch-into-a-usable-workspace),
[J02](../user-journeys.md#j02-add-and-open-a-folder), and
[J03](../user-journeys.md#j03-read-and-edit-source-documents).

Contracts: [Architecture](../../code-review/architecture.md),
[Window Lifecycle](../../code-review/window-lifecycle.md), and
[Renderer Workspace](../../code-review/renderer-workspace.md).

# Workspace

## User Outcome

People enter a local project and start discussing an idea, then write and
refine documents when useful. An empty project is a complete starting state.
Files, Chat, and windows keep their identities without requiring a separate
StashBase storage model.

## Scope and Non-goals

This area owns project registration, folder navigation, the Files sidebar,
tabs, window behavior, and explicit source-file operations. Together with the
Documents area, it forms the Document Workbench. It does not own format
rendering, preparation correctness, retrieval ranking, or Agent session
protocols.

StashBase is not a database-first knowledge base, a block editor, a project
manager, or a primary graph-navigation tool.

## Current Experience

### Enter a project

- Welcome offers opening a folder, creating a project, importing public GitHub
  content, and browsing Gallery copies. Recent lists registered projects;
  removal forgets app-owned state and leaves the folder on disk.
- New windows and app relaunches start at Welcome. The app does not silently
  select a folder, send a prompt, install an Agent, or open sign-in. Entering
  a project restores its saved kept tabs and tree state where available.
- A window keeps one project; another project opens in another window. Windows
  share the registry and services but retain their own work. Equivalent paths
  can resolve to the window already displaying the same project.
- Opening an existing folder preserves its contents. New projects are ordinary
  folders; GitHub imports stage and publish before registration and entry.
  Failed entry retains the previous valid state, and failed publication does
  not remove concurrent user changes.
- A pristine default folder home receives the optional Start Here project.
  Existing homes are not modified, incomplete seeds remain retryable, and
  deleting the seed or updating the app does not recreate or overwrite it.
  Newly seeded guides describe project entry, brainstorming, and writing;
  existing user-owned guide copies retain their original content.

### Discuss and write

- Project Chat starts as the leading work surface while no document is open.
  It can discuss an idea in an empty folder. Actual send depends on the
  selected Agent's readiness, not on the presence of source files or a wiki.
- Documents and Chats are two sidebar modes. Files, outline, and project search
  support document work; Chats lists the project's conversations. Opening a
  document can dock the same conversation beside it. Hiding Chat keeps its
  work; reopening it restores that same context.
- New tab offers Create new draft. It creates an available Untitled Markdown
  filename beside the selected tree location, opens a kept tab, and starts
  inline naming. Existing writing can be opened and edited directly.
- Browsing uses one reusable preview tab; explicitly keeping or editing it
  makes it persistent. Tabs, document history, Quick Open, links, and outlines
  provide navigation without changing file identity. Back/forward follows the
  sidebar mode: document visits or open Chats.
- Agent-created files refresh the tree and become selectable without taking
  focus. Agent links to another authorized project's file can open a read-only
  out-of-folder tab; editing it requires its own project context.
- Removing a project retires its scoped work and returns affected windows to
  Welcome. Started conversation state is not silently reassigned to a different
  project. The unbound internal state is described in [Agent Panel](agent-panel.md).

### Work with project files

- The file tree, Quick Open, and previews follow the
  [Documents matrix](documents.md#format-capability-matrix). Muted generic files
  remain visible but are excluded from retrieval and automatic Agent context.
  Restricted or unavailable entries remain identifiable and can be revealed in
  the system file manager.
- Create, rename, import, and delete are explicit. Agent/MCP tools also expose
  bounded moves. Runtime-native instruction files remain user-owned.
- Ordinary dotfiles remain visible. Show hidden files controls eligible hidden
  directories across windows; it does not expose product-derived state, VCS
  databases, hidden notes, or excluded infrastructure to retrieval.
- Dependency caches and build trees remain bounded excluded rows rather than
  recursive work. Visibility, preparation eligibility, and Agent access are
  separate capabilities.
- Background preparation and indexing do not hold project entry open. Status
  describes actionable failures or readiness; optional setup is not promoted
  as a prerequisite for local work. Recovery drafts have their own restore and
  discard flow, owned by [Documents](documents.md).

### Supporting surfaces

- Gallery is a band on Welcome and an overlay within a project. It supplies
  examples and local copies, never a Chat tab or an automatically sent prompt.
- Settings owns appearance, Agents and account, transcription, optional search
  by meaning, MCP access, app updates, local components, and reporting.
  Signing in enables OpenQuill; local document work remains usable signed out.
- Packaged app updates use a quiet check when enabled and an explicit install
  action with a save barrier. Report a bug starts the dedicated local review
  flow from Settings or native Help.

Exact control placement, visual tokens, and renderer mechanics are maintained
in [Renderer Workspace](../../code-review/renderer-workspace.md) and
[Renderer Styling](../../code-review/renderer-styling.md).

## Experience Contract

- Removing a project preserves independently registered projects nested inside
  it, including their preparation and search availability. Source files remain
  on disk. Every Agent bound to the removed project retires with that scope.
- Explicit Quit finishes after all window saves succeed. A failed save leaves
  the application open and cancels that quit request; normal macOS window
  closing can still leave the application running without windows.

- Folder entry makes discussion and navigation available first; listing, preparation, and indexing continue
  in the background. Code-heavy project infrastructure that cannot surface in
  the Workbench does not make those background scans hold navigation closed.
  The project entry action leaves its **Opening…** state when the local server confirms the
  window-folder binding; a delayed list, ordering read, preparation pass, or
  semantic reconcile cannot extend that state indefinitely.
- GitHub import accepts one public repository URL and one portable folder-home
  child name. Import fields remain locked while Git runs; cancellation cleans
  the import's unchanged partial content and preserves concurrent user additions
  or edits. A successful import is registered before opening, so its project
  remains available from Welcome / Recent if the later window transition fails.
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
  fallback defaults. A durable project registry change fails instead, preserving the
  user's existing configuration for recovery.
- Source and derived state remain distinguishable. The tree and tabs show
  source files, not generated representations.
- Tree completeness is scoped to user workspace content: excluded directory
  placeholders explain intentionally untraversed infrastructure, while hidden
  product-derived artifacts never surface. A collapsed or excluded directory
  does not create descendant DOM. The hidden-files preference widens only
  Workbench visibility — retrieval, indexing, and Agent discovery scope are
  server-owned policies it never changes.
- Repeated or concurrent navigation to one source focuses its existing tab,
  preview or kept, and a window never holds more than one preview tab. A
  preview never outlives the session, and an edit always keeps its tab. The
  same relative path in different registered projects remains a distinct source.
- Back and forward follow the navigator: the document history unless Chats
  is showing, when they step the open Chats. Either way they never change
  the panel or the set of kept tabs.
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
  Settings keeps that action available after an announcement is dismissed.
  Every open renderer crosses the normal save barrier before an installer may
  retire the application. Windows stop accepting input during saving and
  installation, including native installer preparation; a refused save or
  failed installation restores interaction and leaves work open. Linux package installs may also require system administrator
  approval.

## Known Gaps

These are current surface limitations or maintenance issues, not a committed
list of additional product features. They do not make project entry,
brainstorming, or writing incomplete. Document-specific diff is tracked by
[Documents](documents.md#contribution-direction).

- Moving a file has no Workbench control. Create, rename, and delete are
  offered on a tree row; moving one is reachable only through Agent and MCP
  file tools, so the
  [Documents matrix](documents.md#format-capability-matrix)'s file-mutable
  capability is not complete in the Workbench.
- Document tabs cannot be reordered. The strip scrolls and each tab drags as
  its source instead.
- Document history restores the file and the heading or search match it was
  opened at, not the reading position within it. A retained Markdown surface
  keeps its own place while its tab stays open; every other return starts
  from the top or the anchor.
- Favoriting a member and opening one in a second window from the project registry have
  no control. The membership row offers removal only.
- With a folder open the column offers no way to switch to another member or
  to open, create, or import a folder; those actions live on the welcome
  screen, which shows only while no folder is open.
- Preparation that needs the user is signalled only inside the Search panel;
  the folder header carries no attention mark, so a reader in Files or Chats
  is not told until they look.

## Cross-area Seams

- [Documents](documents.md) owns the surface inside a source tab.
- [Preparation](preparation.md) owns background derivation and readiness.
- [Search](search.md) owns project evidence and out-of-folder result
  behavior.
- [Agent Panel](agent-panel.md) owns Chat tabs and scope-pinned sessions.
- Window retirement and file mutation details live in
  [Window Lifecycle](../../code-review/window-lifecycle.md) and
  [File Transactions](../../code-review/file-transactions.md).

## Contribution Direction

### Next

Maintain the implemented project-first workflow, empty-project discussion,
file operations, navigation, and recovery. Keep failures understandable and
large folders responsive. Multi-root windows and new navigation models are
not commitments in the current direction.

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
The retained secondary unbound-Chat creation boundary is
[J11](../user-journeys.md#j11-turn-a-conversation-into-a-project). Optional
Wiki Page building is
[J12](../user-journeys.md#j12-build-wiki-pages-from-a-local-folder).

Contracts: [Architecture](../../code-review/architecture.md),
[Renderer Workspace](../../code-review/renderer-workspace.md),
[Window Lifecycle](../../code-review/window-lifecycle.md),
[File Transactions](../../code-review/file-transactions.md),
[Data Lifecycle](../../code-review/data-lifecycle.md), and
[Settings and Config](../../code-review/settings-config.md).

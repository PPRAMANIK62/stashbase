# Local File Workspace

StashBase is a workspace for ordinary local folders. It should make existing
files easier to work with and easier to hand to an Agent without asking users
to migrate them into a StashBase-specific storage model.

## Current

- Users can add, create, open, and remove local folders from the library.
- Each window centres on one current folder, with its own file tree, document
  tabs, search state, and Agent panel.
- Users can open multiple windows from the application menu or a folder action
  to keep different folders or working contexts visible side by side. A folder
  action focuses an existing matching window when one is already available.
- Users can create, rename, move, and delete files or folders through explicit
  file operations.
- The main pane opens the source file the user selected; generated artifacts
  stay hidden.
- Search results and agent file links return users to those source files.
- Root-level `AGENTS.md` and optional `CLAUDE.md` bridge files are visible,
  editable user files. StashBase only creates missing defaults.

## Experience Contract

- Opening a folder should feel like navigation, not a long preparation task.
- Opening or closing one window must not switch or close another window's
  folder context.
- Closing a window must either save the live edit first or leave the window
  open with a visible save failure.
- Opening a folder from one window must not create an avoidable duplicate when
  another window already owns that context.
- Users must be able to tell whether an operation affects source files or only
  StashBase-owned state.
- Removing a library folder removes derived state, never the user's folder.
- Removing a folder that is open elsewhere saves those windows and returns
  them to the library view instead of leaving stale editable state behind.
- Destructive file operations require clear confirmation.
- The tree is a calm orientation tool, not a separate knowledge graph or
  project-management surface.

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

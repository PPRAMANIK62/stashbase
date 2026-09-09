# Agent document writes and Diffs research for Task 51

Research date: 2026-09-09

## Scope

This note pins what the replacement renderer must build for Task 51 (apply
Agent document writes and Diffs). It records the server behavior the task
consumes, the legacy behavior it replaces, what the replacement already has,
and the implementation decisions. It does not describe Shipping behavior; the
permanent record stays in `design-docs/` and `code-review/`.

Product intent: [Agent Panel](../../../design-docs/design/agent-panel.md),
journey [J07](../../../design-docs/user-journeys.md#j07-converge-chat-into-a-document),
and the [Documents](../../../design-docs/design/documents.md) external-write
rule. Engineering contracts: [Agent Panel](../../../code-review/agent-panel.md),
[Agent Runtime](../../../code-review/agent-runtime.md), and
[File Transactions](../../../code-review/file-transactions.md).

## What already exists and stays where it is

- The server prompts for every write. Claude's Edit, Write, MultiEdit,
  NotebookEdit, and Bash, Codex's file changes, and every MCP mutation
  round-trip a `permission` event that Task 49's card already answers.
- MCP writes go through the shared versioned save path, so the version
  authority in the task title is the file-transactions contract on the
  server, not renderer code. A native Claude or Codex write bypasses the
  server entirely and reaches the index only through a folder sync.
- OpenCode emits `file-diff` events with the whole file on both sides and
  line counts, and its replayed history carries the same data as `FileDiff`
  tool blocks. Both were already in the registered wire schemas.
- The shell refetches the file listing when the folder's tree version
  changes. Only server-side create, delete, move, and sync bump it; a content
  edit or a native write does not.
- Task 33 handles the dirty-editor case: a save over a newer disk version
  meets the reload, merge, or overwrite decision.

## Legacy behavior to carry over

- Edit, MultiEdit, Write, and FileDiff inputs became a line diff with three
  lines of context, rendered inside the permission card and the expanded
  tool row instead of the raw argument payload.
- A `file-diff` event appended a settled `FileDiff` tool block.
- A settled activity group listed each written or edited path once with an
  Open action that resolved the path against the session folder.
- After a successful write tool or a file diff, the legacy panel called
  `POST /api/sync` for the session folder and reloaded the window tree.

## Decisions

1. **One file-change shape.** `AgentFileChange` is a path, an action
   (created, wrote, edited, deleted, changed), optional text on both sides
   with its extent (whole file or edited fragment), an optional unified patch
   when that is all the runtime gave (Codex), and optional server counts. A
   pure `fileChangesForTool(name, input)` reads every runtime's vocabulary,
   including MCP `write_file`, `edit_file`, and `delete_file` arguments, and
   `settledFileChanges(tools)` lists finished work once per path.
2. **Native diffs are settled tool blocks.** The adapter maps `file-diff`
   to a `file-changed` session event; the reducer appends a done `FileDiff`
   block with the same input shape replayed history uses, ignoring a repeat
   of the same id.
3. **The diff is a read-only CodeMirror merge view.** `@codemirror/merge`
   joins the CodeMirror 6 stack the renderer already ships. The unified view
   collapses unchanged regions, highlights word-level changes, takes syntax
   from the language data the code editor already bundles, and is styled by
   a base theme over two new theme tokens: green for additions and red for
   deletions. A Codex patch renders as marked
   lines with the same tints. Diffs.com (`@pierre/diffs`) was evaluated and
   set aside: it renders inside a Shadow DOM with its own Shiki theme, which
   would put a second design system inside the transcript, and its split
   view, annotations, and editing are not needed in a chat column.
4. **One payload ladder.** The tool row and the permission card share
   `AgentToolPayload`: file changes with evidence render as diffs, everything
   else as the bounded inert text Task 49 introduced.
5. **Changed files are listed, never selected.** A settled activity group
   ends with each changed path once, its action, and an Open control only
   when the path resolves to a source inside the scoped folder. Open routes
   through the shell's existing open-document workflow.
6. **Refresh is the shell's job.** The session runtime reports files after a
   write tool settles without error or a native diff arrives, with the
   sources it could resolve. The shell invalidates the folder listing and the
   open documents behind those sources at once, then requests a folder sync
   through a new preparation control method and invalidates listing and
   readiness again when it settles. A clean editor takes the newer text
   through the existing reconcile path; a dirty one keeps its draft and meets
   the versioned conflict on its next save.

## Evidence plan

Focused domain tests for change extraction, settled listing, and path
resolution; session domain and adapter tests for the native diff event;
runtime tests for the change notification; component tests for the diff
view, patch view, permission card, and changed-files list; documents query
test for source refresh; preparation adapter and protocol tests for the
folder sync; typecheck, lint, architecture, and web build.

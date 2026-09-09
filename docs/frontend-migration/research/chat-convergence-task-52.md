# Chat convergence research for Task 52

Research date: 2026-09-09

## Scope

This note pins what the replacement renderer must build for Task 52
(converge Chat conclusions into documents). It records what journey J07
requires, what Tasks 33, 50, and 51 already deliver, the one gap left in
the flow, and the implementation decisions. It does not describe Shipping
behavior; the permanent record stays in `design-docs/` and `code-review/`.

Product intent: journey
[J07](../../../design-docs/user-journeys.md#j07-converge-chat-into-a-document),
the [Canvas](../../../design-docs/glossary.md#canvas) role, the
[Agent Panel](../../../design-docs/design/agent-panel.md) rules on explicit
context, and the [Documents](../../../design-docs/design/documents.md)
Canvas note. Engineering contracts:
[Agent Panel](../../../code-review/agent-panel.md),
[File Transactions](../../../code-review/file-transactions.md), and
[Markdown Rendering](../../../code-review/markdown-rendering.md).

## What J07 asks for

A Canvas is an ordinary Markdown source, not a file type or a transcript
summary. The user explores in Chat, opens the Canvas beside the same
conversation, asks the Agent to write only accepted conclusions into that
source, and then reviews, edits, and saves. The transcript stays exploration
history. Writes target an explicit authorized source through the shared
transaction boundary. Agent-written files refresh the workspace without
selecting themselves or taking focus. A failed, unauthorized, or conflicted
write leaves the existing source recoverable. Nothing merges conversation
branches automatically, and there is no implicit current-document context.

## What already exists and stays where it is

- The shell keeps one split row: the document workbench on the left and the
  Agent on the right, with a persisted seam. Opening the first document only
  changes widths, so the Agent keeps its transcript, draft, and focus. J07's
  "beside the same conversation" is the default layout, not a mode.
- Every write is the server's: Claude, Codex, and MCP writes round-trip a
  permission event whose card shows the diff (Task 51), and MCP writes use
  the shared versioned save path. The renderer never writes on the Agent's
  behalf.
- After a write tool settles or a native diff arrives, the shell invalidates
  the folder listing and the open documents behind the changed sources,
  requests a folder sync, and refreshes readiness. Nothing there selects a
  file. A settled activity group lists each changed path once with an
  explicit Open.
- Task 33 owns recovery: a clean editor adopts newer disk text through the
  reconcile path; a dirty editor keeps its draft and meets the reload, merge,
  or overwrite decision on its next save, with both versions kept.
- Task 50 owns explicit context: `@` mentions over the selected folder's
  listing, file-tree drags, and send-time validation.

## Legacy behavior to carry over

- The legacy J07 journey drove a fake Codex through an approved
  `write_file` of `Canvas.md`, asserted that the Chat tab and the active
  document tab kept their selection, opened the new file from the tree,
  appended text, saw it saved, closed the tab, and reopened it.
- The legacy panel had no Canvas affordance of its own; the user named the
  target by typing its path after `@` or by prose.

## The gap

The replacement satisfies every required result structurally, but step 3 of
the journey has no one-gesture way to name the document the user just
opened. Document tabs are not drag sources, and a bare `@` lists the folder
in path order. The rule against implicit context is right; what is missing
is an explicit gesture that costs less than retyping the file name.

The legacy J07 Playwright journey is also no longer runnable: the served
build is the replacement renderer and eight of the spec's ten distinguishing
selectors do not exist in it. Task 51 recorded that evidence as staying with
the legacy renderer until cutover; it is more accurate to say it is deferred
to finalization and must be rewritten there.

## Decisions

1. **No new write surface.** Convergence is a prompt, not a command. A
   "write conclusions here" control would decide the target on the user's
   behalf and sits under Coordinate First in the Agent Panel doc. The
   Agent's write keeps going through the permission card and the server's
   transaction boundary.
2. **Document tabs are drag sources.** Each open tab writes the same source
   drag payload as a file-tree row, so dragging the Canvas tab into the
   composer binds it as a mention chip through the drop path Task 50
   already validates. The gesture is explicit and the chip serializes as
   `@path` like any other mention.
3. **Open documents lead the `@` list.** The shell publishes the open tabs'
   folder-relative paths alongside the listing it already publishes. The
   mention ranking places open documents ahead of otherwise-equal matches
   and first for the empty query. Typing `@` is still the user's gesture;
   nothing is attached without it.
4. **Refresh and recovery stay where Task 51 and Task 33 put them.** Task
   52 adds no second refresh path and no Canvas-specific save rule. It
   proves the chain instead: one composition test drives an Agent write
   while a document is open and checks that the listing refetches, the
   active tab and focus stay put, Open routes into the document workflow,
   and a clean editor adopts the newer text while a dirty one meets the
   conflict.
5. **Composer focus is detected structurally.** The clipboard-image guard in
   the shell tested for a textarea, which the CodeMirror composer never is,
   so it never engaged. The check now asks whether focus sits inside the
   composer's root, which the skill and mention work in the same composer
   also depends on.
6. **E2E stays deferred, and says so.** Per the migration rules the J07
   journey, journey coverage, and release evidence wait for finalization.
   The ledger row records the legacy spec as unrunnable rather than as
   standing evidence.

## Evidence plan

Focused tests for the tab drag source, mention ranking with open paths, the
shell's composer-focus hook, and one renderer-level J07 composition test;
typecheck, lint, architecture, and web build. Playwright J07, visual, and
accessibility evidence remain deferred to finalization.

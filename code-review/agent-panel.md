# Built-In Agent Panel Design

> Code review contract: this document preserves built-in Agent Panel implementation and review constraints for maintainers and AI reviewers. For contributor-facing panel direction, see [design-docs/design/agent-panel.md](../design-docs/design/agent-panel.md).

This document captures the product design contract for the built-in Claude/Codex panel. The architecture remains in [architecture.md](architecture.md); this file is only about renderer behavior and visual direction.

## Direction

The built-in Agent panel is one folder-scoped chat surface. It should feel like
a focused chat when no document is open and a VS Code-style side panel when a
document is active, not a separate AI workspace.

A session's scope is an explicit choice, not an inherited ambient, and it is
typed: `{ kind: 'library' } | { kind: 'folder'; path }` — a missing choice
is a DEFAULT (the window's current folder when one exists, else the
library), never a third scope. The composer's leftmost pill is a
Cursor-style scope picker: a "Library" entry above a separator, then the
library membership (the same source as the sidebar list, favorites pinned).
It defaults to the window's current folder, and an unbound tab follows the
window when that default changes. Once the conversation has content, runs a
turn, or was resumed, the pill stays visible but locked — a live session is
never rebound to another scope, and its pane header marks a binding that
differs from the window default with a muted note: "in <basename>" for a
cross-folder chat, "in Library" for a library chat while the window has a
current folder. The library scope is always called "Library" in UI copy —
never "Global".

Server-side, the WS connect URL and every session-history route accept an
optional explicit scope — `folder=<abs>` (membership-validated) or
`scope=library`; anything else, including combining the two, is rejected
with an error/400 (`resolveAgentSessionScope`). Absence falls back to the
window's current folder when one exists, else the library
(`resolveSessionBinding`). A library-scoped session runs with cwd = the
folder home (`getFolderHome()`) — the reserved library cwd. Both runtimes'
native history stores key sessions by cwd, so library-scoped history
persists under that reserved cwd, never under any member folder, and lists
via the sessions routes with `scope=library`. Library-scoped sessions do
not write `AGENTS.md`/`CLAUDE.md` bridge files (those belong to member
folders), and their preamble states that the whole library is in scope with
`search_library` as the retrieval path. Caveat: if the user adds the folder
home itself as a library folder, that folder's history and the library
history coincide (same cwd). The History menu lists sessions for the tab's
currently picked scope, and resume carries that scope on the reconnect URL.

Because every session is scope-pinned, a window-folder switch is NOT a
teardown trigger: chat tabs and their running sessions survive the switch,
transcripts (including queued prompts and failed-turn notices) untouched.
Bound tabs keep their binding and the cross-scope header note. What happens
to each tab on a switch is a three-way plan (`windowFolderSwitchPlan`):

- **follow** — a COMPLETELY BLANK tab (no transcript, no queued prompt, no
  active turn, no explicit pick, not resumed, no draft text, no
  attachments) follows the window by reconnecting its next session to the
  new window default.
- **freeze** — a tab that would follow but holds unsent draft text or
  attachments instead promotes its connected scope to an explicit pick:
  the draft keeps the scope the user saw, and neither this nor a later
  switch (or reconnect) can silently rebind it. The composer lifts draft
  presence into the tab model for this (and for the blank flag below).
- **keep** — everything else keeps its binding untouched.

The blank definition above is THE blank-tab rule (`isBlankChatTab`), and
each tab's AgentView mirrors it into `ChatTab.blank`. The sidebar's New
Chat button and the window-folder switch both consume it through
`blankTabToReuse`: reuse a blank tab (preferring the preferred agent's)
as the welcome tab, else create a new tab and make it active. On a folder
switch this must not change panel visibility; only the no-tabs
folder-open path opens the panel with its one fresh tab.

Session teardown happens only on: native window close/retire (`onClose` →
`stopAgentRuntime` per window — this includes library-scoped sessions),
library folder removal (`stopAgentRuntimeForFolder` ends every session
BOUND to the removed folder across all windows, plus the window-close path
for windows currently showing it — library-scoped sessions report no bound
folder and MUST survive any folder removal), and the app-quit cleanup
ladder. The renderer mirrors this: a folder switch keeps `chatTabs` (see
`folderScopedResetActions('switch')`), while losing the window's folder
context (removal, another window closing it) still resets them. The chat
panel renders without a window folder too — a no-folder window can hold
library-scoped chats (the acceptance behavior: with no folder selected the
user can still ask across the whole library, and switching folders yields
a fresh working entry point without losing or silently rebinding any
existing work).

Cross-folder tabs stay scoped to their session folder end to end: `@`
mention ranking and folder-file attachment validation use the session
folder's listing (`GET /api/files?folder=` — membership-validated).
Library-scoped tabs have no single folder listing, so `@` mentions and
sidebar-file attachments are disabled there (retrieval goes through
`search_library`; transient OS-file attachments still work),
`agent-context-file` resolution passes the session folder (the route is
folder-explicit: it takes an absolute member path and validates membership),
and turn-end/tool reconcile syncs the session's folder without reloading the
window's tree. The built-in agent's MCP file tools are absolute-path based;
`STASHBASE_WINDOW_ID` in the session env is request identity only, not a
path-resolution channel. A non-absolute MCP path is a legacy compatibility
ref resolved under the default folder home — never against the window's
current folder — so a window-folder switch cannot misroute a bound
session's MCP file operations; the bound folder reaches native tools through
the session cwd and the system-prompt preamble.

The panel may make agent work easier to scan, but it should stay quiet:

- low chrome
- compact controls
- restrained borders and cards
- no decorative motion or visual metaphor
- no new workspace model separate from the user's local folder

## Renderer foundation

The renderer retains its existing CSS during the Tailwind v4 migration. Shared
semantic theme roles (surface, text, border, focus, status, density, radius,
elevation, and motion) are exposed as CSS variables and Tailwind tokens; new
work consumes those roles rather than inventing visual literals. Shared
dialogs, alert dialogs, menus, popovers, tooltips, and toasts use the
shadcn-generated Base UI adapters under `web-src/src/components/ui/`; feature
code must not recreate their focus, Escape, outside-press, collision, timer, or
announcement behavior. The shared Button adapter is used inside managed
primitives; feature-owned semantic buttons may remain native while the
migration is incremental. App splitters remain renderer-owned layout controls,
but expose separator value semantics, visible keyboard focus, and
platform-neutral Arrow/Home/End transitions. A lazily loaded blocking
primitive uses the shared native-modal loading status until Base UI is ready,
so focus containment, inertness, topmost Escape, and cancellation do not
depend on chunk timing. Never provide a feature-owned dialog fallback. React
Aria Components remain only where they
already own a transitional surface and are not a dependency choice for new
renderer work. Motion is limited to structural/status feedback and runs under
the user reduced-motion policy: transforms and layout animation stop while
essential opacity feedback remains available. Foundation primitives that are only needed
after an interaction may load at that interaction boundary, preserving the
enforced initial-renderer budget without making the feature unavailable.

The agent panel's chrome — tab strip, pane header, transcript container,
tool-activity cards, composer, attachment chips, history menu, and error
banners — is styled with Tailwind utilities and the shared
Button/StatusMessage/Menu/Input primitives. `styles/chat.css` keeps only what
utilities must not own: the `.app` grid tracks and chat splitter, the
chat-primary centring rules keyed on the `agent-head` / `agent-messages` /
`agent-composer` hook classes (keep those class names on the utility-styled
elements), the sticky user-turn header system, `.agent-prose` content
typography plus the One-Dark tool/diff palette, the `@`-mention popup
(`.agent-mention-item.active` is a keyboard-navigation querySelector hook),
and the CodeMirror-owned composer input DOM. `.agent-view` stays a class-name
routing hook for the global drag-drop handler. Composer pill triggers are
labelled controls: each carries a leading icon and an accessible name
("Session folder" / "Session scope: Library", "Model", "Permission mode",
"Reasoning effort"; the locked scope pill appends "— set for this
conversation"), and a default-valued model
or effort pill renders "<Control>: Default" so adjacent Defaults cannot be
confused. An empty chat centers the composer as the hero layout: the
composer swaps its `agent-composer` width hook for the hero column while
empty, and keeps a stable React `key` so the same mounted instance (draft,
CodeMirror state) moves between the hero and bottom layouts. Empty-state
starter templates only prefill the composer draft through the CodeMirror
handle — they must never send. The connecting spinner is a keyframe
animation the global reduced-motion policy stops.

Community contributions can land as useful first iterations, but the long-term design should continue to be simplified toward this side-panel model when needed.

## Design Rules

- Keep the panel renderer-led. Do not change agent transport, session persistence, MCP, indexing, or permission policy just to support presentation changes.
- Derive the shell layout from Chat visibility, document presence, and compact
  viewport state; do not add RAG/CoWork product modes. The chat-primary layout
  removes the document and splitter grid tracks without unmounting either
  surface. Hidden primary surfaces are inert so zero-width content cannot keep
  keyboard focus.
- Opening a folder creates one fresh chat tab for the app-wide preferred
  Agent — but only when the window has no chat tabs. Existing tabs (and their
  folder-bound sessions) survive folder switches, so a switch never spawns an
  extra tab or forces the panel open. The preference defaults to Codex,
  changes only through explicit Agent selection, and is recoverable when
  local UI storage is unavailable. Runtime availability remains
  authoritative: never silently fall back from an unavailable preferred
  Agent.
- Keep the first compact-window document transition document-first. The
  responsive auto-collapse may be undone by an explicit Chat launcher action;
  once the user does that, layout effects must not immediately close Chat
  again. Restore a responsively collapsed chat when the last document closes
  or the window becomes wide, unless the user has since changed visibility.
- Prefer small, familiar agent-chat affordances over a bespoke workbench UI.
- Treat user-action states as first-class. Permission approvals, retry actions, and stopped-turn editing must remain visible and directly actionable.
- Treat terminal turn failures as persistent transcript state. Reset the
  renderer-owned explanation guard on `turn-start`, prefer a live runtime
  error, and add at most one generic fallback for an otherwise unexplained
  failed `turn-end`. Record that failure before advancing queued follow-ups;
  duplicate terminal events must not advance the queue, and successful or
  cancelled turns must not create an error notice.
- A discovered missing Agent CLI is a setup state, not a disabled launcher or a
  generic connection failure. Keep its install command copyable and let the
  user re-run discovery after installation; do not conflate it with an
  installed runtime that has failed.
- Keep background activity compact. Tool calls may be grouped or summarized, but the user must be able to inspect them when needed.
- File outputs should be easy to open, but artifact UI should stay lightweight. Prefer rows or compact affordances over large delivery cards.
- Successful file-changing tools refresh folder and index state but never
  select their output automatically. Only the user's artifact or local-link
  action opens a document and causes Chat to dock.
- Streaming should not steal the user's scroll position. If the user has scrolled away from the bottom, show a clear jump-to-latest affordance.
- The current document is never implicit agent context. Users attach files by drag/drop, file picker, `@` mention, or a composer-focused image paste. Image paste must reuse transient attachments, preserve accompanying text, and suppress the competing clipboard library-import offer.
- The top-bar Claude and Codex icons select or toggle existing chats. Creating a new chat belongs to the in-panel `+`.
- Model catalogs and identifiers belong to their native runtime: use Claude's
  SDK discovery and Codex app-server `model/list`, never a shared hard-coded
  list. `undefined` means Default and must not change global CLI settings.
  Keep the renderer's explicit selected override separate from the runtime's
  active-model telemetry: only the selected override belongs in a new-session
  URL, so a runtime Default model can never be pinned accidentally. Validate a
  requested identifier against the complete current native catalog before a
  new session/turn; a missing, rejected, or stale value clears the override,
  visibly falls back to Default, and remains recoverable. Codex must collect
  every paginated `model/list` page before validation and preserve each model's
  advertised reasoning-effort identifiers/order (including object entries), so
  the effort picker only offers compatible levels. An unset effort is the
  native runtime Default and must be omitted from the connection URL; send one
  only after an explicit user choice. It must initialize and
  publish this catalog before it emits panel-ready, otherwise the first turn
  cannot be selected.
  Do not send a model override when resuming, and lock the picker after chat
  content exists so a transcript cannot silently switch models. Recover the
  active model from native thread/session metadata for both Default and
  resumed chats and surface that identity; a generic “session model” label is
  not sufficient. Preserve a fallback notice if later initialization reports
  the active Default model.

## Current Baseline

The accepted baseline includes:

- per-agent chat tab selection and toggle behavior
- keyboard navigation for `@` file and folder mentions. Ranking normalizes
  Unicode accents and ignores case, punctuation, whitespace, and path
  separators; basename matches precede path-only matches, ties use a
  locale-independent order, and raw workspace-relative paths remain the
  stable item IDs and inserted tokens.
- smooth chat-side resize without drag-frequency global state updates
- adaptive chat-first layout with a centred readable transcript/composer width,
  side-panel width restoration, explicit-hide precedence, and a document-first
  compact-window transition
- compact activity grouping for non-actionable tool calls, with inspectable
  command/read/search labels rather than lifecycle-only summaries
- visible permission cards outside collapsed activity
- lightweight file/artifact open affordances
- jump-to-latest behavior for transcript scrolling
- GFM Agent-message rendering through React elements, never an HTML string or
  raw HTML parser. Keep remote images and non-HTTP(S), non-workspace links
  inert; local links continue through the folder-safe workspace callback.
- React Aria controls for popover dismissal, focus management, and menu/listbox
  semantics, including permission decisions and destructive history
  confirmation. CodeMirror remains the owner of composer text, selection,
  undo, and mention-key handoff; keep its presentation chat-like and its
  height capped so the transcript retains reading space. Image attachments
  show renderer-local thumbnails, never their transient filesystem paths;
  sent thumbnails remain available for the current transcript, while their URLs
  are revoked when removed, the transcript is replaced, or the panel unmounts.
  Restored Claude and Codex sessions may recreate thumbnails only for live
  transient image files through the scoped local preview route; never expose
  an arbitrary path found in a transcript. The route resolves the real target
  under a non-symlinked private attachment root before it reads it. Effort
  selection, including Default, remains open across the session reconnect
  caused by a change. Its trigger stays available as a close action during that
  reconnect, while a closed picker cannot reopen until the session is ready. Leave
  trigger, Escape, and outside-interaction dismissal to the managed popup
  primitive. When a permission action removes its own controls, restore focus
  to the persistent tool-card trigger.
- Image-preview controls float over the image: Download and Close at the top
  right, and a bottom-centred zoom group. They need accessible names and hover
  titles; do not replace their semantic buttons with non-interactive artwork.
  Use clean, optically centred `+` and `−` line glyphs for zoom rather than
  ornate magnifying-glass icons; keep the floating control surfaces borderless.
- Skills use the composer’s `/` suggestion path, not a separate workbench
  control. The shared contract exposes only opaque selection ids and compact
  metadata; native paths remain server-side. The inline `/skill` composer token
  is display state and must not be serialized into the user prompt. Codex resolves a current id from
  `skills/list`, refreshes on `skills/changed`, and sends a native skill input;
  Claude discovers commands through its SDK and invokes the selected command
  natively. An empty or failed discovery response remains visible from the
  composer; retry only refreshes the catalog and never blocks normal prompts.
  Never concatenate skill-file contents into a prompt.

These are still implementation details, not a new product category. If the panel starts to feel heavier than VS Code/Codex/Claude Code side chat, the preferred follow-up is to reduce visual weight rather than add more structure.

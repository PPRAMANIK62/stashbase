# Agent Panel

The built-in Agent Panel is one adaptive chat surface for the current local
folder. Chat is the primary workspace until a document is opened, then becomes
a compact, VS Code-like side panel alongside that document. It is a convenient
client of StashBase context, not a separate AI workspace.

## Current

- Users can work with supported Agent runtimes in separate chats and restore
  prior chat history.
- Every chat has an explicit scope: one library folder, or the whole
  library ("Library"). With no folder selected, users can still ask across
  the whole library — a library chat searches all folders, runs against no
  single folder, and keeps its own history separate from any folder's.
- A New Chat split button at the top of the sidebar (above the Library
  list) is the one place chats are created and Agents are chosen. Its
  main area starts a chat with the last-selected Agent; a subtle chevron
  at the row's right edge offers New Claude Code Chat / New Codex Chat,
  and picking one also updates the default for later New Chat clicks.
  The chat is scoped to the window's current folder — or to the Library
  when no folder is current — and it reuses a completely blank chat when
  one exists instead of stacking empty tabs, switching that chat's Agent
  in place when it differs; any content, unsent draft, attachments, or
  resumed session means a fresh chat instead. New Chat opens the chat
  panel when it is hidden. Switching between open chats belongs to the
  chat tabs (each carries its Agent's glyph); the pane header shows only
  the chat's title — chat history lives in the sidebar (below).
- Chat history lives on the sidebar's scope rows: the current folder's
  header row, the Library section header, and every folder row in the
  Library list carry a History action (hover-revealed on list rows)
  listing that scope's past sessions — both Agents' chats in one list,
  newest first, each row showing its Agent's glyph. Rename and delete work
  per row, and one Agent's history failing to load still shows the other's
  with a quiet inline note. Picking a session opens it in the chat panel
  under the New Chat reuse rule: a completely blank chat is reused
  (switching its Agent when needed), otherwise a new chat opens for that
  session's Agent, and the conversation resumes within its own scope —
  started chats are never hijacked. The Library header's History keeps
  library chats reachable even when no folder is selected.
- Opening a folder starts a fresh chat with the user's last selected Agent
  when the window has no chats yet. Codex is the default until the user
  explicitly selects another Agent. An unavailable preferred runtime remains
  a visible setup state; StashBase does not silently substitute another
  runtime.
- Chats survive switching the window's folder: every chat is pinned to its
  own scope, so changing the sidebar's current folder keeps the open chat
  tabs and their running sessions intact. A chat whose scope differs from
  the window keeps working against its own scope — mentions, attachments,
  and context resolve there. Switching folders activates a welcome chat
  for the new folder: a completely blank chat is reused (it follows the
  window's folder), otherwise a new chat appears — no existing work is
  ever lost or silently rebound. A chat with unsent draft text or
  attachments keeps the scope the user saw instead of following the
  window. Folder chats end when their window closes, when their folder is
  removed from the library, or on app quit; library chats end only with
  their window or on app quit — removing a folder never ends them.
- With no document open, Chat fills the workspace beside the Files sidebar.
  Opening a file, search result, local response link, artifact, or new note
  moves the same mounted chat into the side panel. Closing the last document
  expands an open chat again. On compact windows a newly opened document takes
  priority; explicitly reopening Chat gives it the primary area until hidden.
- When a runtime supplies its native model catalog, a compact per-session
  selector shows Default plus that runtime's available models. Default leaves
  the user's CLI configuration intact; StashBase never rewrites it or turns the
  runtime's active Default model into a saved override. A model is fixed once a
  chat has content or is resumed, so history cannot silently move to another
  model; new and resumed chats show the identity reported by their native
  runtime. If a saved choice becomes unavailable or is rejected at turn start,
  the next new chat recovers to Default with an explanation. Reasoning controls
  only offer the levels supported by the active model when the runtime reports
  that compatibility. Effort begins at Default and leaves the native runtime
  untouched until the user explicitly chooses a level. Those choices remain
  plainly labeled and easy to select; they are never represented only by
  decorative slider marks.
- A new chat's empty state makes the composer the hero: it centers in the
  panel, and a single muted usage suggestion sits toward the pane's
  bottom edge, rotating through scope-appropriate "Ask me to …" lines on
  a quiet timer that pauses while the suggestion is hovered or focused.
  A single short title above the composer — "Your knowledge is here." —
  names the space; no wordmark or agent branding beyond that: the tab's
  Agent glyph and the composer's "Message <Agent>…" placeholder carry
  the runtime identity, and the scope pill carries the scope. The hero composer carries a slightly taller input
  and the one sanctioned raised shadow. Pressing the suggestion only
  prefills its full prompt into the composer draft for the user to edit;
  sending stays an explicit user action. Once the chat has content — or the session ends or fails —
  the composer returns to the bottom of the transcript (flat, compact
  presentation). While a session connects, a small spinner with muted
  text shows above the composer.
- Each chat is scoped to an explicitly chosen library folder or to the
  whole library. The composer's leftmost pill is a scope picker: a
  "Library" entry above the folder list (every library folder with
  favorites pinned, name plus shortened path detail), defaulting to the
  window's current folder — or to Library when none is current; a tab
  without a started session follows that default. Once the chat has
  content or is resumed the pill stays visible but locked — a conversation
  never moves to another scope — and resumed chats show their own scope.
  When a chat's binding differs from what the window shows, the pane
  header adds a muted note — "in <folder>" for a cross-folder chat, "in
  Library" for a library chat while a folder is open — so cross-scope
  chats stay legible. The sidebar's History menus list sessions per
  scope header. `@` mentions plus sidebar-file attachments offer the
  chat's own folder — not the window's — for cross-folder chats, and are
  unavailable in library chats (which retrieve through library search;
  uploaded files still attach).
- During a library chat the Agent can create a new project on request: a
  `create_project` tool creates the folder (under the default folder home
  unless the user names a valid location), registers it into the library so
  every window's sidebar lists it, and — with no further user action — the
  window owning the chat selects it while the chat itself moves to the new
  project: the scope pill flips from "Library" to the project name and the
  session appears in that project's History instead of the library's. A
  chat already bound to a folder never moves — the tool still creates and
  registers the project and tells the Agent the chat stays where it is.
- The composer bar shows three session facts: the scope pill on the left
  (beside the attach control), then the model and mode pills grouped on
  the right next to send. Model stays its own labelled pill and shows a
  concrete model name whenever the runtime reports one — including the
  catalog's default for a fresh session — falling back to "Model:
  Default" only when no identity is known. The mode pill's panel stacks
  the permission-mode list with the reasoning-effort bar at the bottom
  (the Claude Code treatment); a non-default effort echoes on the trigger
  ("Ask · High"). Sections appear only when the runtime supports them;
  locked controls stay visible but inert.
- The panel supports streaming responses, stop and retry paths, queued
  follow-ups, and inspectable tool activity.
- A failed turn leaves exactly one persistent inline explanation in the
  transcript, preferring the runtime's specific message when available. The
  failure remains attached to its turn before any queued follow-up continues.
- Users explicitly attach context through mentions, file selection, drag and
  drop, or pasting an image while the composer is focused; the current
  document is never implicit Agent context. Pasted images are transient chat
  attachments, never library imports.
- Permission requests remain actionable. Limited edit workflows can be
  streamlined, while deletion, commands, network access, and broader access
  stay explicit approval decisions.
- Agent file outputs refresh the Files sidebar without moving the user away
  from Chat. Their compact Open affordances and local file links lead back into
  the local workspace only when the user chooses them.
- Agent response Markdown supports GFM, but treats raw HTML and remote images
  as inert content; only workspace-relative links and HTTP(S) links are active.
- If a supported Agent CLI is missing, opening a chat for it shows a compact
  setup state with the copyable install command and a runtime-refresh action.
  A missing CLI is distinct from a runtime that is installed but failed to
  start.

## Experience Contract

- Keep the panel quiet: compact controls, restrained chrome, and no decorative
  workbench metaphor.
- Treat chat-primary and document-side-panel presentation as two layouts of
  the same mounted session. Layout changes must preserve transcript state,
  streaming work, attachments, scroll position, and the user's remembered
  side-panel width. The panel's surface color is layout-independent — the
  chat canvas stays the same in both layouts so opening a document reads
  as a resize, never a mode change (see visual-style.md).
- Respect explicit visibility choices. Automatically open Chat once per folder
  entry, but do not reopen it after the user hides or closes it in that folder.
- Do not hide permission cards or recovery actions inside collapsed activity.
  Permission and tool payloads render human-readable: MCP `arguments` are
  hoisted, empty scaffolding fields are dropped, and string values print
  verbatim (real newlines, clipped to a screenful) — never a JSON-escaped
  dump of a whole document.
- While the agent is actively thinking or running a tool, that meta label
  carries a soft text shimmer (reduced motion: static muted label). The
  generic "is working…" tail renders only when no visible block already
  narrates the moment — never beside a live tool summary, live thinking,
  or a pending permission card (where the agent is waiting on the user).
  File mutations — native File change and MCP write/edit alike — always
  surface as openable artifact cards; chat tab titles flatten mention
  paths to file names. Each
  assistant reply block reveals a corner ⋯ menu on hover — Copy Message
  today, room for more actions later. Every user message reveals in-card
  copy and edit actions on hover; editing resends the edited text as a
  new prompt (sessions cannot rewind, so no forking).
- Streaming must not steal reading position from a user inspecting earlier
  transcript content.
- Presentation changes must not create a separate agent, context, permission,
  indexing, or MCP model.
- Popup controls use maintained accessible primitives while the CodeMirror
  composer remains responsible for typed content and mention keystrokes. The
  composer presents as a capped-height chat input, with ranked file and folder
  mentions that search workspace paths without case, punctuation, whitespace,
  or separator sensitivity,
  image attachment thumbnails that remain visible in sent messages and restored
  history while their transient files are available, open the existing image
  preview with floating image actions and bottom-centered zoom controls, and clear
  Send/Stop states rather than editor UI.
- Choosing an Agent effort level, including Default, keeps the picker available
  while the fresh Agent session reconnects, so users can observe or refine the
  setting. The current model and effort choices remain visually prominent using
  the active application theme.
- Typing `/` in the composer opens the same compact, keyboard-accessible
  suggestion surface used for `@` file mentions, filtered to skills available
  to the active runtime. Selecting a skill leaves an inline `/skill` token in
  the composer and applies it only to the next message; ordinary prompts remain
  unchanged. An empty catalog and a discovery failure remain visible inline;
  the latter offers a retry without blocking ordinary prompts. StashBase discovers and invokes skills but
  never installs, edits, or otherwise manages them.
- The panel complements external MCP clients; it does not replace the
  bring-your-own-agent direction.

## Contribution Map

### Next

- Improve transcript scanning, tool-activity summaries, and file-change
  presentation.
- Improve attachment and mention selection, including more focused document
  context handoff.
- Clarify runtime, recovery, settings, and context diagnostics.
- Continue refining the low-chrome adaptive chat and side-panel visual
  language.

### Coordinate First

- Permissions, auto-approval, tool execution, or filesystem scope.
- New context-passing behaviour and agent/session lifecycle.
- MCP, indexing, or file-handling changes made solely for panel UI.

### Not Planned

- A StashBase-owned closed Agent product.
- A separate AI workspace or transcript-centred file manager.
- Presentation work that weakens explicit user control of context or access.

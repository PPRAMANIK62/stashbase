# Agent Panel

The built-in Agent Panel is one adaptive chat surface for the current local
folder. Chat is the primary workspace until a document is opened, then becomes
a compact, VS Code-like side panel alongside that document. It is a convenient
client of StashBase context, not a separate AI workspace.

## Current

- Users can work with supported Agent runtimes in separate chats and restore
  prior chat history.
- Opening a folder starts a fresh chat with the user's last selected Agent.
  Codex is the default until the user explicitly selects another Agent. An
  unavailable preferred runtime remains a visible setup state; StashBase does
  not silently substitute another runtime.
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
- If a supported Agent CLI is missing, its launcher opens a compact setup state
  with the copyable install command and a runtime-refresh action. A missing CLI
  is distinct from a runtime that is installed but failed to start.
- If a live runtime disconnects unexpectedly, the panel preserves its
  transcript, clears in-flight activity, explains the terminal cause once, and
  offers Reconnect. Intentional session teardown remains quiet.
- If Codex cannot confirm that a turn started, that turn fails visibly. A
  later prompt recovers through a fresh native connection so output from the
  abandoned attempt cannot enter the active chat.

## Experience Contract

- Keep the panel quiet: compact controls, restrained chrome, and no decorative
  workbench metaphor.
- Treat chat-primary and document-side-panel presentation as two layouts of
  the same mounted session. Layout changes must preserve transcript state,
  streaming work, attachments, scroll position, and the user's remembered
  side-panel width.
- Respect explicit visibility choices. Automatically open Chat once per folder
  entry, but do not reopen it after the user hides or closes it in that folder.
- Do not hide permission cards or recovery actions inside collapsed activity.
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

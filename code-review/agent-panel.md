# Built-In Agent Panel Design

> Code review contract: this document preserves built-in Agent Panel implementation and review constraints for maintainers and AI reviewers. For contributor-facing panel direction, see [design-docs/design/agent-panel.md](../design-docs/design/agent-panel.md).

This document captures the product design contract for the built-in Claude/Codex panel. The architecture remains in [architecture.md](architecture.md); this file is only about renderer behavior and visual direction.

## Direction

The built-in Agent panel is one folder-scoped chat surface. It should feel like
a focused chat when no document is open and a VS Code-style side panel when a
document is active, not a separate AI workspace.

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

Community contributions can land as useful first iterations, but the long-term design should continue to be simplified toward this side-panel model when needed.

## Design Rules

- Keep the panel renderer-led. Do not change agent transport, session persistence, MCP, indexing, or permission policy just to support presentation changes.
- Treat an adapter exit, including one during startup, as a terminal session
  event. Its optional message is the single fatal cause: preserve transcript,
  clear busy/tool activity, and do not append a second failed-turn notice. A
  raw post-ready socket close gets the stable agent-specific disconnect
  fallback; explicit renderer/client teardown must suppress it.
- Derive the shell layout from Chat visibility, document presence, and compact
  viewport state; do not add RAG/CoWork product modes. The chat-primary layout
  removes the document and splitter grid tracks without unmounting either
  surface. Hidden primary surfaces are inert so zero-width content cannot keep
  keyboard focus.
- Opening a folder creates one fresh chat tab for the app-wide preferred
  Agent. The preference defaults to Codex, changes only through explicit Agent
  selection, and is recoverable when local UI storage is unavailable. Runtime
  availability remains authoritative: never silently fall back from an
  unavailable preferred Agent.
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
- Present a stalled Codex `turn/start` as one failed turn, then let a later
  prompt recover through a fresh native connection. Late events from the
  abandoned start must not enter the renderer; the server-side timeout and
  generation-fencing contract lives in [architecture.md](architecture.md).
- Claude session error normalization must preserve execution failure details before emitting `turn-end`: trim and deduplicate SDK error lists to a joined message capped at 2,000 characters, resolve max-turn, max-budget, and structured-retry error subtypes to stable fallback copy, and treat transient api_retry warnings as retry-in-progress without ending the turn.
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
  For resumed Claude history, render the server-reported effort and keep
  missing or unsupported metadata visibly inherited instead of inventing a
  renderer default. Replay must tolerate a protocol-v1 server retained during
  restart. Changing effort on an idle restored session retains its rendered
  transcript and native identity; the server-side history and writer lifecycle
  contract lives in [architecture.md](architecture.md).

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

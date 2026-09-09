# Source context and mentions research for Task 50

Research date: 2026-09-09

## Scope

This note pins what the replacement renderer must build for Task 50 (attach
source context and mentions). It records the server contracts the task
consumes, the legacy behavior it replaces, what the replacement already has,
and the implementation decisions. It does not describe Shipping behavior; the
permanent record stays in `design-docs/` and `code-review/`.

Product intent: [Agent Panel](../../../design-docs/design/agent-panel.md),
journey [J06](../../../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat),
and the [Documents format matrix](../../../design-docs/design/documents.md#format-capability-matrix).
Engineering contracts: [Agent Panel](../../../code-review/agent-panel.md),
[Agent Runtime](../../../code-review/agent-runtime.md), and
[MCP Access](../../../code-review/mcp-access.md).

## What the replacement renderer has today

- The composer is the shared `InputMessage` component over a plain textarea.
  It already owns a controlled `files: File[]` list with drop, picker,
  preview tiles, and a queue, but knows nothing about library mentions.
- `AgentSessionRuntime.sendPrompt(text)` sends `{ t: 'prompt', text }` and
  nothing else. Queued prompts hold `{ id, text }`.
- The user transcript block already carries an optional `attachments` list,
  filled by history replay through `agent-sessions` wire schemas, but the
  transcript renders only the text.
- The shell gives the agent feature an `AgentScopeOutline` (top-level names)
  for starter prompts only.
- The preparation feature owns `sourceReadiness(status, path)` and the
  folder status query; `FolderIndexStatus.conversionVersions` carries one
  integer version per prepared source. `SourceReference` (folder path plus
  relative path) is the shared identity.

## Server contracts

- `GET /api/library/agent-context-file?path=<folder>/<relative>` answers
  `AgentContextFile`: absolute `path`, `folder` label, `sourcePath`,
  `readPath`, `kind: 'direct' | 'derived'`, `sourceFormat`, `available`,
  `reason`. Unsupported formats answer 415, missing files 404.
- `POST /api/agent/attach` (multipart `files`) writes each file into a
  per-batch temp directory outside every library folder and answers
  `{ files: [{ name, path? , error? }] }` in request order.
- The prompt client event is `{ t: 'prompt', text, skill?, titleHint? }` for
  every runtime. Context travels inside `text` as an `Attached files:`
  suffix; mentions travel as `@<relative path>` inside the prose. History
  replay on the server rehydrates that suffix back into `attachments`.
- Runtime capability `attachments: boolean` says whether transient uploads
  are readable by that runtime. Built-in answers false.

## Legacy behavior to carry over

- `@` suggestions rank the session folder's files (retrievable viewer formats
  only) and normal folders by name prefix, name substring, path prefix, path
  substring, then shorter basename and path order. Library scope disables
  mentions.
- A mention inserts an atomic chip; the serialized prompt reads `@path`.
- Attachments come from OS files, sidebar drags of library files, and image
  paste. Sidebar drags are validated against the session listing.
- At send time each attachment resolves through the context-file route. A
  derived source becomes a line that tells the agent to read the derived
  text through `mcp__stashbase__read_file`; an unavailable prepared format
  becomes a line that says the text is not available yet and why.
- The listing is refetched when a tool wrote files or the folder scope
  moved; a retired scope disables the listing and attachment resolution.

## Decisions

1. **One bound-context model.** `AgentContextItem` is a union of a library
   source (`SourceReference`, format, and the conversion version seen when it
   was bound) and a transient upload (absolute temp path, display name,
   preview). Session state holds the draft `context`; each queued prompt
   holds its own snapshot; sent user blocks keep their items for chips.
2. **Validation is pure and re-run at send and at dispatch.** A source is
   `stale` when its path left the scope listing or the scope retired;
   `preparing`, `failed`, or `blocked` when preparation says so; `ready`
   otherwise. A stale item blocks the send with the draft intact. A changed
   version only re-resolves the read path.
3. **Wire format unchanged.** The prompt stays text-only. A pure
   `renderPromptContext` builds the `Attached files:` suffix from resolved
   context-file answers exactly as the legacy renderer did, so both runtimes
   and history replay keep working.
4. **Feature boundary.** The agent feature never imports preparation or
   workspace. The shell passes a `scopeListing` (files with format, normal
   folders) and a `readiness` map keyed by relative path, both derived from
   queries it already runs. The shell also handles Reprocess through the
   preparation control API.
5. **Mentions are inline chips.** The shared composer gains an editor slot,
   and the Agent feature fills it with a CodeMirror document in which a
   mention is one atomic widget, ported from the legacy `MentionComposer`.
   The chip sits where it was typed, moves with the text, and deletes as one
   character; the serialized draft reads `@path` in its place, so text and
   context never disagree and the wire prompt is unchanged. Transient uploads
   and dropped visual sources reuse the composer's preview row and appear
   only when the runtime advertises attachments or the source is an image or
   PDF.
6. **Transient upload is a separate port.** `AgentContextPort` offers
   `resolve(source)` over the JSON client and `upload(files)` over the
   server origin, mirroring the workspace upload adapter.

## Evidence plan

Focused domain tests for ranking, validation, and prompt rendering; adapter
tests for the context port; runtime tests for send, queue dispatch, and stale
rejection; component tests for the suggestion listbox, chips, and transcript
chips; protocol tests for the two new wire schemas; typecheck, lint,
architecture, and web build.

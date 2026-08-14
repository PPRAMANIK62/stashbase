# Agent Panel

## User Outcome

People collaborate with a supported local Agent against an explicit library or
folder scope, then bring durable results back into ordinary local files.

## Scope and Non-goals

The Agent Panel is the product capability; Chat is its visible conversation
surface. This area owns built-in Chat creation, tabs, scope selection,
transcript, composer, attachments, permissions, history, and adaptive layout.
Runtime installation, native process ownership, MCP access, and indexing have
separate engineering contracts.

The panel is not a closed StashBase Agent product, a separate AI workspace, or
a transcript-centered file manager.

## Current Experience

- Chat is expanded from the first window frame. With no document it fills the
  workspace beside Files; opening a source docks the same mounted session as a
  side panel. Closing the last document expands an open Chat again.
- The sidebar New Chat split button is the only creation entry. Its main action
  uses the remembered Agent; its chevron changes the default without starting
  a chat. A completely blank chat is reused instead of stacked.
- Opening the app or a folder creates presentation state only. New Chat opens
  the selected Agent's readiness gate. A supported system or managed runtime
  continues normally; a missing runtime waits for the explicit **Install and
  continue** action before StashBase downloads the official managed runtime in
  AppData and connects StashBase MCP.
- Preparation failures identify the stage that needs recovery. Installation
  failure offers retry and, when useful, the provider's install command; MCP
  failure offers connection retry and the manual MCP access guide. A failed
  MCP write never presents an installation command.
- Every chat is pinned to either Library or one member folder. A blank chat can
  follow the window default; content, a draft, attachments, or resumed history
  freezes the scope. Folder switches preserve started chats and running work.
- History anchors on the sidebar: the active folder's header lists that
  folder's sessions, and the New Chat row lists ALL sessions across the
  library — each row labeled with its home folder and resumed in its own
  scope. Both menus merge supported Agent sessions; a listing failure for
  one Agent does not hide the other.
- The empty chat centers the composer and a quiet, scope-appropriate suggestion
  that only prefills text. With content, the composer returns to the bottom of
  the transcript.
- Model, permission mode, and reasoning effort reflect the active runtime's
  capabilities. Defaults do not rewrite global CLI settings; a populated or
  resumed conversation cannot silently change model or scope.
- Streaming responses, stop, retry, queued follow-ups, tool activity,
  permission requests, attachments, skills, and file artifacts remain
  inspectable. Completed working traces fold so final answers are easy to scan;
  actionable permissions and recovery never hide inside the fold.
- Editing and resending while a response is active stops that response, then
  starts the edited text as the next turn. It does not leave the new message
  waiting beneath activity that belongs to the old turn.
- The current document is never implicit context. Users attach or mention files
  explicitly. Agent-created files refresh Files but open only when selected.
- A library-scoped Agent may create a project. Only the attributed calling
  library chat migrates to that project; folder chats and external callers do
  not silently rebind.

- Agent response Markdown supports GFM plus locally bundled KaTeX for inline
  and display math. Formula rendering is presentation-only: Copy Reply and
  restored history retain the original Markdown/LaTeX source. Raw HTML and
  remote images remain inert; only workspace-relative links and HTTP(S) links
  are active. Incomplete or invalid formulas stay visible rather than breaking
  a streaming response, and wide display math scrolls inside the reply.

## Experience Contract

- Chat-primary and docked layouts are two presentations of the same mounted
  session. Transcript, streaming, draft, attachments, scroll, and remembered
  width survive the transition.
- Respect explicit visibility. Initialization opens Chat; later automatic
  layout changes do not override a user hide or reveal.
- Opening, switching, or resuming an Agent tab is not installation consent.
  Each missing runtime waits for its own explicit setup action.
- A runtime, transport, or turn failure leaves one persistent explanation and
  a truthful, stage-specific recovery path. Retrying preparation resumes from
  the first incomplete stage. Late output from an abandoned generation cannot
  enter a newer turn.
- Permission, deletion, command, network, and broader filesystem decisions
  remain explicit. Tool payloads render in a human-readable form.
- Streaming does not steal the reading position of someone inspecting earlier
  content.
- Agent response Markdown treats raw HTML and remote images as inert; only
  validated workspace links and HTTP(S) links are active.
- Discovering and invoking a runtime skill never installs, edits, or exposes
  the skill implementation through the composer.

## Cross-area Seams

- [Workspace](workspace.md) owns the current folder, source tabs, and shell.
- [Documents](documents.md) owns source editing beside Chat.
- [Search](search.md) owns retrieval identity and readiness.
- [Agent Runtime](../../code-review/agent-runtime.md) owns native lifecycle.
- [MCP Access](../../code-review/mcp-access.md) owns Agent file boundaries.

## Contribution Direction

### Next

- Improve transcript scanning, tool summaries, and file-change presentation.
- Improve attachment, mention, and focused context handoff.
- Clarify runtime, recovery, settings, and context diagnostics.
- Continue refining the compact, low-chrome adaptive layout.

### Coordinate First

- Permission policy, auto-approval, tool execution, or filesystem scope.
- Session lifecycle, history identity, or new context-passing behavior.
- MCP, indexing, or file behavior added only for panel presentation.

### Not Planned

- A second knowledge store or StashBase-owned closed Agent service.
- Implicit current-document context.
- Presentation that weakens explicit access or recovery decisions.

## Related Journeys and Contracts

Journeys: [J06](../user-journeys.md#j06-start-and-continue-an-agent-chat) and
[J07](../user-journeys.md#j07-converge-chat-into-a-document).

Contracts: [Agent Panel](../../code-review/agent-panel.md),
[Agent Runtime](../../code-review/agent-runtime.md),
[Settings and Config](../../code-review/settings-config.md), and
[MCP Access](../../code-review/mcp-access.md).

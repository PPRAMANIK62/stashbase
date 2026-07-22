# Agent Panel

The built-in Agent Panel is a compact, VS Code-like side panel for working
alongside the current local folder. It is a convenient client of StashBase
context, not a separate AI workspace.

## Current

- Users can work with supported Agent runtimes in separate chats and restore
  prior chat history.
- The panel supports streaming responses, stop and retry paths, queued
  follow-ups, and inspectable tool activity.
- Users explicitly attach context through mentions, file selection, or drag and
  drop; the current document is never implicit Agent context.
- Permission requests remain actionable. Limited edit workflows can be
  streamlined, while deletion, commands, network access, and broader access
  stay explicit approval decisions.
- Agent file outputs and local file links lead back into the local workspace.

## Experience Contract

- Keep the panel quiet: compact controls, restrained chrome, and no decorative
  workbench metaphor.
- Do not hide permission cards or recovery actions inside collapsed activity.
- Streaming must not steal reading position from a user inspecting earlier
  transcript content.
- Presentation changes must not create a separate agent, context, permission,
  indexing, or MCP model.
- The panel complements external MCP clients; it does not replace the
  bring-your-own-agent direction.

## Contribution Map

### Next

- Improve transcript scanning, tool-activity summaries, and file-change
  presentation.
- Improve attachment and mention selection, including more focused document
  context handoff.
- Clarify runtime, recovery, settings, and context diagnostics.
- Continue refining the low-chrome side-panel visual language.

### Coordinate First

- Permissions, auto-approval, tool execution, or filesystem scope.
- New context-passing behaviour and agent/session lifecycle.
- MCP, indexing, or file-handling changes made solely for panel UI.

### Not Planned

- A StashBase-owned closed Agent product.
- A separate AI workspace or transcript-centred file manager.
- Presentation work that weakens explicit user control of context or access.

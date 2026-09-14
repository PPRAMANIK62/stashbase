# Overview

StashBase is an **IDE for writing**: develop ideas with an Agent and turn them
into documents in ordinary local projects.

Enter a project → brainstorm → write → refine.

An empty project is valid. Discussion can remain exploration or lead to writing;
references, search, and wiki building are optional. Typical work includes articles,
reports, proposals, research notes, and returning to earlier drafts.

## Working Modes

- **Documents:** a VSCode-like file and editor workspace.
- **Chat:** a Claude/ChatGPT-like conversation workspace.

Both share the project and preserve unfinished work when switching.
[Writing Workspace](design/writing-workspace.md#documents-and-chat-modes)
defines their behavior.

## Product Principles

- **Ordinary files are authoritative.** Documents and Agent-written wiki pages
  remain user-owned; extracted text, checkpoints, and indexes stay hidden.
- **One project scope.** Each folder has an independent search namespace.
  Missing results or failures never broaden access.
- **Deliberate actions.** Discussion does not implicitly authorize file changes,
  attach an open document, install a runtime, or start sign-in.
- **Local work stays available.** Browsing, editing, preview, and keyword search
  require no account. Agent and optional embedding requests use their configured
  services; local ownership does not imply offline model execution.
- **Preserve continuity.** Mode changes and background work retain documents,
  conversations, and drafts. Failures offer recovery without silently losing work.

OpenQuill, Claude Code, and Codex use the same project/file model. Preparation,
retrieval, MCP, and Gallery support that work without creating a separate store.

## Feature Status

Project entry, discussion, drafting, editing, preparation, indexing, and retrieval
are implemented. **Document-specific diff is coming soon**; its scope is in
[Product Direction](product-direction.md). Known limitations and missing evidence
remain in the area designs and [Journey Coverage](../code-review/journey-coverage.md).

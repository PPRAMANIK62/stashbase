# Product Direction

## Document-specific diff — remaining feature

**Coming soon.** Review prose changes inline in the readable document, retaining
paragraphs and formatting. Show deleted words/phrases with red strikethrough and
additions in green; support individual and whole-set acceptance or rejection.

Existing Agent file diffs and editor/disk conflict comparisons remain separate.
They do not supply this pending-suggestion workflow or a universal approval gate
for Agent writes.

Decisions still needed: supported formats, change segmentation, pending-suggestion
persistence, and integration with saving and version conflicts.
[Writing Workspace](design/writing-workspace.md) owns the experience;
[Agent Panel](../code-review/architecture.md#agent-sessions-and-permissions) and
[File Transactions](../code-review/architecture.md#source-transactions) own its integration.

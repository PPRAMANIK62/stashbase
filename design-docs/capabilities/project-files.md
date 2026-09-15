# Project Files

## Scope

Documents, Agent tools, external MCP, and file import operate on ordinary local
files. They share source identity and content-preservation rules; access and
editing capabilities remain explicit for each surface.

## Format Capability Matrix

| Source | Documents mode | Retrieval text | Agent/MCP content access |
|---|---|---|---|
| Markdown | Read/edit; new drafts use Markdown | Source text | Read/write source |
| Plain text | Read/edit valid UTF-8 | Source text | Read/write valid UTF-8 |
| JSON | Source-preserving editing | Source text | Read/write source |
| HTML | Preview only | Extracted in memory | Read/write raw HTML |
| PDF | Source preview | Prepared Markdown | Read prepared text |
| Image | Source preview | Prepared OCR text | Native attachments depend on runtime; MCP does not return image bytes |
| DOCX | Sanitized preview with prepared fallback | Prepared HTML | Read prepared text |
| Audio/video | Playback when supported, otherwise open externally | None | None |
| Generic file | Bounded read-only UTF-8 or explicit unavailable state | None | None |

Playback depends on codecs. Previewability, content editing, file mutation, and
retrieval are independent capabilities. The [glossary](../glossary.md#format-capability)
defines those distinctions; [Project Context](project-context.md) owns preparation.

## Shared Rules and Differences

- Reads, edits, search results, and file links retain project-and-path identity.
  Missing files and invalid encoding never justify substituting another source
  or rewriting bytes lossily.
- Workbench rename/delete applies to ordinary visible files, including generic
  files. Agent/MCP moves and writes require their own authorized capability.
  Protected entries are reveal-only; derived data remains hidden.
- Renaming or deleting a source never migrates or deletes neighboring files
  merely because their names match retired extraction formats. Current derived
  data is owned separately in AppData.
- Hidden-file visibility changes browsing only. It neither widens tool/search
  access nor discards open edits.
- Project import creates source files; same-name imports keep both copies using
  a new name. A partial import retries only refused files. Chat attachments are
  temporary context and never become project files merely by being attached.
- Agent writes follow runtime permissions and produce ordinary files. File
  refreshes do not steal focus or imply a universal accept/reject gate.

## Saving and Release

Save against the version that was read. Preserve source formatting and unrelated
content. A changed source requires conflict handling; completed writes must not
be reported as failed merely because search updates lag.

Document navigation and mode changes retain live work. Autosave is independent of
which document is visible. Closing a dirty document, leaving its project, quitting,
or installing an update must settle affected saves or keep that work available.
A save acknowledgement clears only the submitted edit, preserving newer changes.
Crash/shell-remount recovery reads saved files; newer unsaved text is not recoverable.

Rename/delete coordinates affected open drafts before mutation and changes their
identities only after confirmation. Cancelling or failing the operation preserves
recoverable work. Rollback must not replace newer user or external changes.

## Failure and Recovery

| Situation | Required result |
|---|---|
| Refresh, preview, or save fails | Keep usable content, source identity, and any live draft; offer recovery at the affected surface. |
| Source changed or disappeared | Preserve the draft and report the source state; never silently recreate or overwrite it. |
| Write conflict | Keep local and disk versions for a deliberate decision; the Documents journey owns the user's resolution flow. |
| Outcome unknown | Establish the result before repeating a mutation; an import may require inspecting the refreshed file list. |
| Search update fails after save | Confirm the save and report search lag separately. |

## Document-specific Diff

**Coming soon:** review prose suggestions inline while retaining document structure,
with red strikethrough deletions, green additions, and individual or whole-set
accept/reject. Current file diffs and save-conflict comparisons do not implement it.
Supported formats, segmentation, suggestion persistence, and save/conflict
integration remain undecided.

## Related Journeys

[J02](../journeys/README.md#j02-add-and-open-a-folder),
[J03](../journeys/README.md#j03-read-and-edit-source-documents),
[J05](../journeys/README.md#j05-search-and-open-source-evidence),
[J06](../journeys/README.md#j06-start-and-continue-an-agent-chat),
[J07](../journeys/README.md#j07-converge-chat-into-a-document),
[J08](../journeys/README.md#j08-connect-an-external-agent-through-mcp),
[J10](../journeys/README.md#j10-turn-a-local-project-into-durable-agent-assisted-work),
[J12](../journeys/README.md#j12-build-wiki-pages-from-a-local-folder).

[Documents journey](../journeys/documents.md) owns navigation and conflict choices.
[Source transactions](../../code-review/architecture.md#source-transactions)
and [document trust](../../code-review/architecture.md#document-and-window-trust)
own implementation constraints and known trust limits.

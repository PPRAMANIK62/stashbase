# Search and Retrieval

Search turns the local library into usable context for people and agents. It
serves in-app search and MCP retrieval while preserving the user's source file
as the result identity.

## Current

- Keyword retrieval supports exact and no-embedding scenarios.
- Semantic retrieval supports meaning-based discovery when configured.
- In-app search is a popup (⌘⇧F / Ctrl+Shift+F, the titlebar Search
  control, or the Command Palette) in the app's palette chrome, searching
  the whole library by default. A scope pill can narrow the next search to the active
  folder or one of its subfolders; with no folder open, search still answers
  library-wide.
- The popup remembers its query, mode, toggles, scope, and results across
  close and reopen — and across the folder switch its own result-opens
  cause. Reopening silently refreshes the remembered results against
  current content.
- Opening a result never switches the window's folder. A hit in the active
  folder opens normally (highlight and find hand-off, tree reveals the
  file); a hit in another member folder opens as a read-only out-of-folder
  tab in the same window, with a banner naming its folder and offering to
  open that folder in a new window. Only the no-folder workspace binds the
  picked folder on open — there is no context to preserve there.
- The search mode is one state-showing toggle: lit "≈ Similar" (the
  default) searches by meaning, quiet "= Exact" matches literal text, with
  exact-mode sub-options (Aa / Word) beside it. The label always names the
  current state; the ≈/= mnemonics never stand alone. The scope pill closes
  the same row as the chat composer's quiet scope pill — one "pick a
  scope" trigger across the app — showing "All folders", the active
  folder's name, or the picked subfolder's name. Its menu is a compact
  indented subfolder list (hierarchy by indentation, full path in the
  tooltip), not the composer menu's icon-and-description rows.
- Results from outside the active folder carry a quiet folder label;
  in-document find escalates to the popup ("All files") carrying its query
  and exact-mode options, scoped to the current folder.
- Results identify the source file, path, and useful evidence such as a snippet
  or page/timestamp hint. In-app snippets start at the file's content: a
  leading YAML frontmatter block never renders in the result list.
- Semantic results show the strongest matches first, up to a relevance-knee
  count, and reveal the remaining fetched candidates through progressive
  disclosure without another request. The summary reports the visible and
  available counts (for example, "8 of 30 results"), and each hit carries a
  per-hit relative match-strength indicator. The indicator is relative to the
  fetched result set, not an absolute score, because hybrid scores have no
  absolute meaning.
- Prepared PDF, image, DOCX, and media transcript text can be evidence, but
  opening a result returns to the original source file.
- Search distinguishes disabled, preparing, partially ready, paused, failed,
  and ready semantic states. A paused folder keeps a persistent Start indexing
  action while keyword search remains usable. The popup's readiness banners
  describe the active folder — other folders' readiness is not yet reported.
- A sync failure is diagnostic and does not replace an awaiting or paused
  decision; its recovery action remains visible alongside failure guidance.
- MCP offers orientation, search with file-type categories, read, reindex,
  and bounded file operations to authorized Agent clients. The in-app popup
  does not expose a file-type filter — categories are an agent-facing
  parameter.

## Experience Contract

- Search should be useful before semantic indexing is available.
- Result identity is always a user-visible source file, never a hidden chunk or
  generated note.
- Scope and access restrictions apply equally to app and MCP retrieval.
- Readiness should be understandable: missing results may be caused by
  preparation, indexing, scope, or search mode.
- Known-stale vectors are removed before a large changed-content workload is
  paused; still-current indexed files may continue to provide partial results.
- Embedding credentials need access only to the configured embedding model;
  provider model-list access is not required.
- On macOS, saving credentials recovers from a same-owner ACL that blocks the
  app-owned config directory. Other config access failures explain the
  ownership or write-access problem without exposing an internal temp path.
- MCP is context infrastructure, not unrestricted host-filesystem access.

## Contribution Map

### Next

- Improve clarity around search modes, readiness, partial results, and errors.
- Report readiness library-wide — the popup's banners cover only the active
  folder today.
- Improve ranking, snippets, navigation to evidence, and useful filters.
- Make context and MCP diagnostics easier to understand.
- Improve search quality for diverse local document collections.

### Coordinate First

- Result identity, source-file opening, retrieval scope, or access control.
- Indexing contracts, embeddings, storage, or sync/reconcile.
- New MCP capabilities that can read, write, or expose user data.

### Not Planned

- A vector-store or chunk-management console for ordinary users.
- Requiring semantic search for the basic browsing and keyword workflow.
- Exposing generated artifacts as normal search results or files.

See [Preparation](preparation.md) for the origin of searchable derived text.

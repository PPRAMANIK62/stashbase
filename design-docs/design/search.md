# Search and Retrieval

Search turns the local library into usable context for people and agents. It
serves in-app search and MCP retrieval while preserving the user's source file
as the result identity.

## Current

- Keyword retrieval supports exact and no-embedding scenarios.
- Semantic retrieval supports meaning-based discovery when configured.
- In-app search starts from the current folder and can narrow its scope.
- Results identify the source file, path, and useful evidence such as a snippet
  or page/timestamp hint.
- Semantic results show the strongest matches first, up to a relevance-knee
  count, and reveal the remaining fetched candidates through progressive
  disclosure without another request. The summary reports the visible and
  available counts (for example, "Showing 8 of 30 ranked candidates"), and
  each hit carries a per-hit relative match-strength indicator. The indicator
  is relative to the fetched result set, not an absolute score, because hybrid
  scores have no absolute meaning.
- Prepared PDF, image, DOCX, and media transcript text can be evidence, but
  opening a result returns to the original source file.
- MCP offers orientation, search with the same file-type categories as the
  app, read, reindex, and bounded file operations to authorized Agent clients.

## Experience Contract

- Search should be useful before semantic indexing is available.
- Result identity is always a user-visible source file, never a hidden chunk or
  generated note.
- Scope and access restrictions apply equally to app and MCP retrieval.
- Readiness should be understandable: missing results may be caused by
  preparation, indexing, scope, or search mode.
- MCP is context infrastructure, not unrestricted host-filesystem access.

## Contribution Map

### Next

- Improve clarity around search modes, readiness, partial results, and errors.
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

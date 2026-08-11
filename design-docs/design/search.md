# Search and Retrieval

Search turns the local library into usable context for people and agents. It
serves in-app search and MCP retrieval while preserving the user's source file
as the result identity.

## Current

- Keyword retrieval supports exact and no-embedding scenarios, including raw
  JSON keys and values.
- Semantic retrieval supports meaning-based discovery when configured.
- In-app search is a popup (⌘⇧F / Ctrl+Shift+F, the titlebar Search
  control, or the Command Palette) in the app's palette chrome, searching
  the whole library by default. A scope pill narrows the next search to any
  one library folder — the same picker, folder list, and rows the chat
  composer binds a session with, so "which folder" is one control learned
  once. A folder scope names its folder outright and therefore survives a
  window folder switch.
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
- Scope and mode sit on the query row itself, right-aligned — they qualify
  the query being typed, and a separate settings band under the field spent
  a whole row on two short controls. The placeholder names the live scope
  ("Search in library" / "Search in <folder>"). No result tally: the list
  already shows what came back, and a count that changes on every keystroke
  is movement beside the caret.
- The search mode is one state-showing toggle: lit "≈ Similar" (the
  default) searches by meaning, quiet "= Exact" matches literal text, with
  exact-mode sub-options (Aa / Word) joining beside it. The label always
  names the current state; the ≈/= mnemonics never stand alone.
- Results from outside the active folder carry a quiet folder label;
  in-document find escalates to the popup ("All files") carrying its query
  and exact-mode options, scoped to the current folder.
- Results collect under the folder they live in, a quiet band naming each
  group (shown only when the library spans folders). Grouping never resorts
  by folder: a group sits where its strongest hit would have, and hits keep
  rank order inside it. A row then leads with what it is — file glyph, file
  name, and its in-file location as muted context — over a two-line snippet
  of evidence. In-app snippets are reading text: a leading YAML frontmatter
  block never renders, and Markdown syntax is flattened away (link text
  survives, link targets do not).
- Semantic results are listed strongest first, all of them, with no
  disclosure control: the fetch candidate count is the only limit, and the
  summary reports one number. Rank order is the only strength signal —
  hybrid scores carry no absolute meaning, so a per-hit gauge would invite
  comparisons it cannot support.
- The popup holds a fixed height and scrolls its results internally. Results
  arrive and change count while the user types, and a panel that resizes
  under the pointer makes the list impossible to aim at.
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
 - The `data` type category selects JSON. JSON semantic indexing uses raw source
   text and keeps the visible source path as result identity.

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

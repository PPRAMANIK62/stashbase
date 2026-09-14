# Search and Retrieval

## User Outcome

People and Agents find relevant project material when discussion or writing
calls for it, and return to the visible source. Retrieval is implemented within
one authorized project; a conversation with no reference lookup is also valid.

## Scope and Non-goals

This area owns exact and meaning-based retrieval, result presentation,
readiness explanations, scope, and source-evidence identity. Together with
Preparation, it forms the local RAG layer. It does not own source preparation,
general file navigation, or Agent conversation UI.

StashBase does not expose a vector-store console or generated chunks as
user-managed results.

## Current Experience

- Keyword search works without any setup over the direct Source or current
  prepared representation declared by the
  [Documents format matrix](documents.md#format-capability-matrix), including
  raw JSON, valid UTF-8 plain text, and current prepared text. Plain-text files
  with unsupported encodings are excluded from exact and semantic evidence
  rather than decoded lossily. MFS applies smart-case or case-sensitive
  literal matching, Unicode whole-word matching, scope filters, and bounded
  work before StashBase formats source-visible snippets.
- With an embedding key added under Settings, retrieval can also search by
  meaning. It is off until then, and nothing outside Settings names it before
  it is on. Product copy keeps the phrase lowercase; engineering terms such as
  semantic indexing and embeddings appear only where technically necessary.
- Agent lookups without an explicit mode use text matching without an
  embedding key and combine meaning-based similarity with text matching when
  a key is configured. The choice is made on every lookup, including after
  key removal, and covers current prepared document text. Explicit modes are
  honored: requesting search by meaning without a key reports a configuration
  error. Provider failures do not silently fall back to keyword search.
  There is no per-Chat search switch; lookup selection never pauses background
  Preparation or indexing.
- Turning search by meaning on is one action: adding an OpenAI or OpenRouter
  key under **Settings → Search by Meaning**, billed to the person who adds
  it. There is no hosted source and no account path; the StashBase account
  buys OpenQuill's credits and nothing for search. Removing the key turns
  search by meaning off again and keeps keyword search.
  Building the semantic index runs in the background; keyword search remains
  available in every project while that work is pending.
- Project search is a panel in the sidebar, reached from its navigator tab or
  a keyboard shortcut. Both modes are folder-explicit. They search the active
  folder, and a match outside it is not offered. The panel keeps its query and
  mode while another panel is on screen and across folder switches, then
  refreshes results against current content.
  A registered nested project owns its own search namespace; its sources do
  not remain as stale results in an ancestor project's index. Both modes
  discard deleted sources and unavailable or outdated prepared text before
  returning evidence.
- MCP retrieval uses one `search_project` operation for one Folder. In an
  attributed folder Chat it defaults to that Chat's Folder. An external client selects a Folder returned by `list_projects` and passes
  it explicitly. An unbound Chat must first open or create a project. Empty results never broaden to another Folder.
  Meaning-based and text-only strategies share the same visible source-hit
  shape and may both narrow by path prefix and source file-type categories.
  The operation resolves an omitted mode from current key configuration;
  session attribution constrains the project, not a separate retrieval toggle.
- Search is keyword search alone until a key is on: one field, no mode
  chooser, and nothing that names the other mode. Once a key is on, the **By
  keyword** and **By meaning** modes share one query surface. Results
  preserve relevance within the selected project.
- A result always identifies a source file. Evidence may come from PDF, DOCX,
  OCR, or transcript text, but opening it never exposes AppData, and opening
  one never switches the active folder.
- Readiness distinguishes preparing, partial, failed, and ready
  states once a key is on; before that the search panel says nothing about
  search by meaning at all. Keyword search remains usable throughout.
- Nothing offers the setup. A window with no folder open stays quiet, a
  folder that resolves stays quiet, and the search panel carries no route into
  Settings for a mode it does not show. Settings is the one place search by
  meaning is turned on, and Build Wiki
  ([J12](../user-journeys.md#j12-build-wiki-pages-from-a-local-folder)) never
  opens or waits for it. The observable path lives in
  [J05](../user-journeys.md#j05-search-and-open-source-evidence).
- Reconcile always offers the current Folder's admitted text projections to
  MFS, which skips unchanged revisions. Without a key the namespace keeps
  vector indexing off and serves exact search; adding a key activates
  meaning-based indexing. There is no size-based pause or first-index decision
  in the Shipping flow.
- Semantic runtime refreshes after key changes remain background work.
  Overlapping refresh and folder-removal activity does not interrupt local
  browsing or surface native process errors as user actions.
- Meaning-based indexing and queries are billed by the key's provider to the
  person who added the key. StashBase shows no quota for search; **credits**
  names OpenQuill's free quota and nothing about search.
- In-app and MCP retrieval share source identity and access rules. MCP also
  supports validated source-type categories.
- Representative semantic retrieval quality is measured by a versioned,
  synthetic corpus with paraphrased queries. It is credentialed release
  evidence rather than deterministic source-CI evidence.

## Experience Contract

- Missing results can be explained by scope, mode, preparation, indexing, or
  provider state; those states must not collapse into one generic empty view.
- Known-stale semantic evidence is unavailable before failed or pending work is
  presented. Current indexed files may still provide partial results.
- Result scope never widens silently, and a derived path never crosses the
  product boundary.
- Previewability alone never claims retrievable text. Each result comes from a
  direct-text or current prepared-text capability and resolves to the visible
  source.
- Choosing keyword matching for a lookup leaves background indexing alone.
  Removing the embedding key disables meaning-based indexing and retains
  keyword retrieval and prepared-document access. These are different actions.
- The embedding key is managed only through Settings. Signing in to the
  StashBase account is not a search action and never changes the source.
  Browsing local files and serving an existing local index never depends on
  online authentication.
- No surface outside Settings offers, names, or explains search by meaning
  while it is off. A person who wants it finds it where the other
  bring-your-own capabilities live, and the mode appears the moment the key
  is on.
- Account and credential ownership remains outside renderer and indexing
  presentation. Persistence and process-boundary invariants live in
  [Settings and Config](../../code-review/settings-config.md).
- MCP is context infrastructure over authorized folders, not a general host
  filesystem interface.

## Cross-area Seams

- [Preparation](preparation.md) owns the currency of derived evidence.
- [Documents](documents.md) owns navigation after a result opens.
- [Workspace](workspace.md) owns member folders and out-of-folder tabs.
- [Agent Panel](agent-panel.md) consumes the same retrieval through MCP.

## Contribution Direction

### Next

Maintain the implemented capability's reliability, useful status, and recovery
within the existing scope. No additional feature is committed here; the
remaining product feature is [document-specific diff](../product-direction.md#document-specific-diff--remaining-feature).

### Coordinate First

- Source identity, scope, access control, indexing, embeddings, or reconcile.
- New MCP capabilities that expose or mutate user data.

### Not Planned

- Requiring search by meaning for the basic local workflow.
- A hosted source for search by meaning, or a sign-in that turns it on.
- Offering search by meaning unprompted, on any surface.
- A chunk or vector administration surface for ordinary users.
- Generated artifacts as normal files or result identities.

## Related Journeys and Contracts

Journeys: [J01](../user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J05](../user-journeys.md#j05-search-and-open-source-evidence), and
[J08](../user-journeys.md#j08-connect-an-external-agent-through-mcp). The
end-to-end route is the
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop.

Contracts: [Data Lifecycle](../../code-review/data-lifecycle.md),
[Renderer Workspace](../../code-review/renderer-workspace.md),
[Settings and Config](../../code-review/settings-config.md), and
[MCP Access](../../code-review/mcp-access.md).

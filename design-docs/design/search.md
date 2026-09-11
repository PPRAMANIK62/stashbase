# Search and Retrieval

## User Outcome

People and Agents can find relevant evidence across authorized local folders
and return to the user-visible source that supports it.

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
  rather than decoded lossily. Whole-token search applies its result cap
  after token filtering, so substring-heavy files do not hide later eligible
  evidence.
- With an embedding source configured, retrieval can also search by meaning.
  Product copy keeps the phrase lowercase; engineering terms such as semantic
  indexing and embeddings appear only where technically necessary.
- Agent retrieval combines meaning-based similarity with text matching for
  every Chat whose folder has a source configured, and uses text matching
  alone otherwise, including current prepared PDF, DOCX, image, and media
  text. The strategy is per lookup and never pauses background Preparation or
  semantic indexing.
- Setting up search by meaning offers hosted account access as the primary
  path and OpenAI/OpenRouter keys as an advanced path. The active source
  remains explicit, and browser sign-in returns to the initiating window or
  offers a deliberate app-return action. Upgrades retire a previously selected
  local source before indexing starts: a signed-in account takes priority,
  then a stored BYOK credential, otherwise searching by meaning returns to
  not set up.
- Library search is a panel in the sidebar, reached from its navigator tab or
  a keyboard shortcut. Both modes are folder-explicit. They search the active
  folder, and a match outside it is not offered. The panel keeps its query and
  mode while another panel is on screen and across folder switches, then
  refreshes results against current content.
- MCP retrieval uses one `search_library` operation across the whole library
  for Library Chats and external clients. In an attributed folder Chat it
  defaults to that Chat's folder; global search requires an explicit request
  (`scope: "library"`). Empty results do not automatically broaden scope.
  Meaning-based and text-only strategies share the same visible
  source-hit shape and may both narrow by folder root, path prefix, and source
  file-type categories. An attributed panel Chat's own retrieval policy
  resolves the operation's strategy without asking the Agent to select a
  different tool.
- The **By keyword** and **By meaning** modes share one query surface. Results
  preserve rank while grouping evidence by folder when needed.
- A result always identifies a source file. Evidence may come from PDF, DOCX,
  OCR, or transcript text, but opening it never exposes AppData, and opening
  one never switches the active folder.
- Readiness distinguishes disabled, preparing, partial, paused, failed, and
  ready states. Keyword search remains usable while searching by meaning is
  not set up or deferred.
- Setting up search by meaning is strongly recommended but never gates local
  browsing, editing, preview, keyword search, or building Wiki Pages. A window
  with no folder open stays quiet. Once a folder resolves, a non-blocking
  notice in the strip above the workspace offers the hosted account or a
  bring-your-own key. It is a notice and not a dialog on purpose, because
  onboarding must not stand between a reader and the files just opened. **Choose
  a source** opens the Search by Meaning section of Settings; declining reads
  **Not now**.
- Either answer is recorded the moment it is given, as one durable
  application-level preference, so no later folder and no relaunch repeats the
  offer. A folder that already has a source configured never carries the
  notice, and the notice waits until both the stored answer and that folder's
  readiness are known, so someone already set up never sees it flash. The
  offer records which revision it answered, so a materially rewritten
  invitation can be shown again deliberately rather than by accident. Build
  Wiki never opens or waits for the setup. The observable activation paths
  live in
  [J01](../user-journeys.md#j01-complete-onboarding-and-reach-first-value)
  and [J12](../user-journeys.md#j12-build-wiki-pages-from-a-local-folder).
- After declining, the **By meaning** mode is the route back. Selecting it
  while no source is configured explains the state and opens the owning
  Settings section. Settings reaches the same section directly.
- Deferring a large first index build for one folder is a different decision
  from declining setup, even though both offer **Not now**. Deferring leaves
  the configured source in place and shows that folder as paused.
- Semantic runtime refreshes after account, quota, or key changes remain
  background work. Overlapping refresh and folder-removal activity does not
  interrupt local browsing or surface native process errors as user actions.
- Hosted indexing and meaning-based queries draw from one pool of included
  monthly credits. User-facing copy calls this quota **credits**; `allowance`
  names only OpenQuill's seven-day quota, so the two never share a word.
  The Search by Meaning panel in Settings shows the provider display name when
  available, retains the full email for account identification, falls back to a
  stable label otherwise, and shows the remaining percentage and reset date. When the credits are exhausted, hosted
  semantic work stops while keyword search and every local-file workflow
  remain available. Pending semantic work resumes after the credits
  refresh or an available BYOK source is selected.
- In-app and MCP retrieval share source identity and access rules. MCP also
  supports validated source-type categories.
- Representative semantic retrieval quality is measured by a versioned,
  synthetic corpus with paraphrased queries. It is credentialed release
  evidence rather than deterministic source-CI evidence.

## Experience Contract

- Missing results can be explained by scope, mode, preparation, indexing, or
  provider state; those states must not collapse into one generic empty view.
- Known-stale semantic evidence is unavailable before a paused large workload
  is presented. Current indexed files may still provide partial results.
- Result scope never widens silently, and a derived path never crosses the
  product boundary.
- Previewability alone never claims retrievable text. Each result comes from a
  direct-text or current prepared-text capability and resolves to the visible
  source.
- Searching by meaning is a use-time retrieval choice. Turning it off must
  neither make prepared documents unreadable nor stop, remove, or foreground
  the background semantic-index lifecycle.
- BYOK credentials and account source selection are managed through Settings.
  Account login starts only from an explicit Sign in action in the setup
  invitation or the Search by Meaning section of Settings.
  Browsing local files and serving an existing local index never depends on
  online authentication.
- The offer is answered once and never re-asked on its own. A route back into
  setup must stay reachable without one, because a person who declined early
  gets no second prompt.
- Account and credential ownership remains outside renderer and indexing
  presentation. Persistence and process-boundary invariants live in
  [Settings and Config](../../code-review/settings-config.md).
- MCP is context infrastructure over authorized folders, not a general host
  filesystem interface.

## Known Gaps

- In-app search no longer reaches the whole library. Both modes are bound to
  the active folder, with no scope control, while
  [J05](../user-journeys.md#j05-search-and-open-source-evidence) and the
  [J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
  core loop describe finding evidence across authorized folders. MCP retrieval
  still defaults to the whole library, so a person's reach is now narrower
  than an Agent's.
- The durable choice in
  [Product Direction](../product-direction.md#activating-search-by-meaning)
  expects standing routes back into setup after a decline. Two ship: the **By
  meaning** mode and Settings. The Files panel carries no standing setup
  action, and the mode's explanation appears only while that mode is selected,
  so the recovery is thinner than the decision assumed. Section and credential
  ownership is [Settings and Config](../../code-review/settings-config.md).

## Cross-area Seams

- [Preparation](preparation.md) owns the currency of derived evidence.
- [Documents](documents.md) owns navigation after a result opens.
- [Workspace](workspace.md) owns member folders and out-of-folder tabs.
- [Agent Panel](agent-panel.md) consumes the same retrieval through MCP.

## Contribution Direction

### Next

- Clarify modes, partial readiness, paused work, and errors.
- Report library-wide readiness rather than only the active folder.
- Improve ranking, snippets, source navigation, and useful filters.
- Improve MCP and context diagnostics.

### Coordinate First

- Source identity, scope, access control, indexing, embeddings, or reconcile.
- New MCP capabilities that expose or mutate user data.

### Not Planned

- Requiring search by meaning for the basic local workflow.
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

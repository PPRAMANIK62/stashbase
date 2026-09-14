# Data Lifecycle

> Correctness and liveness contract for preparation, indexing, reconcile, and
> AppData-owned derived state. Source mutation transactions live in
> [File Transactions](file-transactions.md).

## State Ownership

| State | Owner | Truth rule |
|---|---|---|
| Sources and Wiki Page Markdown | User filesystem | Durable source of truth |
| Library membership, Agent Instructions, credentials, preferences | App config | Durable product configuration |
| Prepared text and assets | AppData | Rebuildable; valid only for the current source |
| Preparation failures and explicit cancellation | AppData state database | Durable attention and user intent |
| Queued, yielded, and running work | Process-wide scheduler | Disposable; reconcile must rediscover loss |
| Search projections and semantic rows | Python daemon / MFS | Rebuildable; MFS text owns exact retrieval and daemon status owns semantic readiness |
| Unsaved draft snapshots | Server-private local data | Durable user intent; never rebuildable and never derived, owned by [File Transactions](file-transactions.md#crash-recovery-draft-journal) |
| Renderer readiness snapshots | Renderer memory | Explanatory only; never completion truth |

## Format Completion

- Markdown, HTML, JSON, and UTF-8 TXT use source-owned text paths. JSON validity
  is not an admission gate and JSON/TXT never join note bundles or legacy-
  derived hiding. Invalid UTF-8 TXT is not indexed; reconcile removes any stale
  semantic row and reports the decode failure. Generic workspace files remain
  outside Preparation, exact retrieval, semantic admission, and automatic Agent
  context.
- Image OCR is complete when its current derived result carries the completion
  marker. The result may contain no text: that is a stable, non-searchable
  success and must not create a preparation failure or retry loop.
- PDF text is complete only when current derived Markdown has the terminal
  completion marker. Batch scratch is resumable work, never truth.
- Durable DOCX text is complete only when current sanitized derived HTML has
  extractable text and its marker. The direct renderer preview has no durable
  completion state and does not wait for this path.
- Media preparation requires both validated structured transcript JSON and
  timestamped Markdown with the terminal marker. StashBase owns playback and
  transcription; only the completed current transcript text is projected into
  MFS. Chunk checkpoints and the lazy compatible playback preview never
  establish transcript completion.
- Conversion completion is independent of semantic indexing. Current prepared
  text can serve exact retrieval while semantic indexing is disabled, pending,
  or failed.
- A Chat's **Search by meaning** switch is consumption policy only. Off routes
  its attributed retrieval through direct and current prepared text without
  pausing Preparation, reconcile, or semantic indexing.
- **wiki/** pages are ordinary visible Markdown, not AppData-derived state.
  Agent write reconciliation admits them through the same exact/semantic paths
  as other Markdown. Activation/backfill for search by meaning and Build Wiki
  may complete independently.

## Scheduler and Cancellation

- One process-wide scheduler owns light, heavy, and auxiliary classification
  capacity. Format modules provide work and cost; they do not own private
  queues.
- Ordering is explicit interaction, any open-folder work, then library
  background work. Background aging may rise only to open-folder urgency.
  Running tasks are not preempted except for the explicit same-source media
  preview handoff.
- Work identity retains the filesystem spelling used for I/O and display while
  a separate platform-aware comparison identity handles deduplication and
  subtree matching.
- Cooperative yield is allowed only at a durable work-unit boundary. It keeps
  task identity and completion promise while releasing capacity; partial
  output remains incomplete.
- User Cancel is durable and blocks rediscovery until Reprocess. Shutdown,
  source mutation, folder removal, or native failure are typed transient
  interruptions unless their owner explicitly records a failure.
- Cancelling native work owns the descendant process tree and waits for
  process/output-handle retirement before reporting the task released.
- PDF/OCR preparation never owns a visible console window. POSIX extractors use
  a detached process group for tree signals; Windows PDF/OCR extractors stay
  attached, hide their console, and use `taskkill /T` for descendant
  cancellation.

## Reconcile

Reconcile is folder-explicit and is the only operation that catches storage up
with disk reality. It runs after server boot, folder entry, visible idle
library maintenance, focus return, manual Sync, MCP reindex, Agent turn
completion, and relevant configuration changes.

For one folder it must:

- discover added, changed, moved, and deleted sources;
- apply the shared hidden/project-directory exclusions before descending, use
  one yielding asynchronous directory traversal for all prepared formats, and
  keep code dependency and build trees from blocking folder navigation or
  becoming format-specific discovery work;
- apply that same eligibility before upload, save, move, folder-rename link
  rewrites, sync reconciliation, and manual Preparation scheduling; moving
  content into an excluded or hidden namespace removes stale semantic rows
  and derived conversion state rather than creating new conversion or indexing
  work, and directory-scoped Search rejects that namespace too;
- validate current format-specific derived output;
- preserve durable failure or cancellation gates;
- schedule missing work without blocking navigation;
- offer complete admitted projections and apply MFS's added, updated,
  unchanged, or removed result;
- hide unavailable or orphaned evidence from retrieval.

No-op reconcile spends no embedding work. Without an embedding source it still
offers complete text projections to an MFS namespace whose vector indexing is
off, which keeps exact retrieval current without a provider call.

Adding or removing a BYOK key, or switching between OpenAI and OpenRouter,
resets and rebinds the single daemon so stale runtime credentials cannot
survive. Account sign-in and sign-out do not affect indexing. Pending work
remains reconcilable and resumes when a supported BYOK source is available.

Daemon retirement is single-flight across shutdown, credential reset, and
recovery callers. A replacement generation waits until the retiring child has
exited and released its MFS resources; a late event from an older generation
cannot clear the current readiness latch or reject current operations. If a
runtime reset lands after a folder bind but before reconcile upserts, the
daemon's binding-loss result is a recoverable lifecycle fingerprint: retry the
authoritative operation once from bind instead of persisting a per-file index
failure.

Large semantic workloads run automatically once BYOK is configured. No
size-based decision or pause is published in the current flow. The unresolved
large-index product policy is recorded as a TODO in
`research/mfs-migration.md`.

## Freshness and Visibility

- Format dispatch must preserve the product capability classes in the
  [Documents matrix](../design-docs/design/documents.md#format-capability-matrix).
  Direct-text sources remain usable without durable Preparation; prepared-text
  sources become readable only through current, format-owned output; a
  preview-only surface never changes either classification.
- Workbench visibility is wider than reconcile discovery. Generic files and
  excluded-directory placeholders may appear in the tree without becoming
  daemon admission, keyword-search, or Preparation work.
- A newly queued source invalidates stale final output immediately, then the
  extractor repeats cleanup at execution.
- A prepared projection crosses into MFS only after its format owner accepts
  the derived artifact as current. MFS hashes that complete projection and
  owns its unchanged decision.
- Daemon mutation acknowledgements are visibility barriers: after a completed
  delete or move, immediate status/search cannot observe rows reported removed.
- Process readiness is a configured barrier, not merely a child-process event:
  current admission rules and every retained folder binding are acknowledged
  before a public daemon operation can run after initial spawn or respawn.
- Each Folder maps to one deterministic MFS Internal namespace. Visible
  Folder-relative paths are its DocumentIds. The namespace key derives from
  the Folder comparison identity; MFS document status is the only accepted-
  projection catalog. Existing namespaces reopen without an embedding
  credential for exact search, upsert, list, and cleanup; only vector indexing
  and search by meaning require BYOK. Store deletion failures propagate across the daemon boundary;
  they are never converted into a successful zero-row result.
- Retrieval filters unavailable sources and always remaps evidence to a live
  visible source before it crosses HTTP or MCP.
- Exact retrieval is MFS `grep` over the accepted text revision. MFS applies
  smart case, whole-word, path, extension, document, byte, and global-match
  bounds before StashBase formats source-visible snippets.
- Node owns filesystem traversal, path comparison identity, preparation
  freshness, and the complete text projection handed to MFS. MFS owns
  projection content identity, revision status, unchanged classification,
  processing, chunking, embedding, vector storage, and retrieval through its
  public API; the adapter does not query MFS implementation tables.
- Closing or failing to open the store releases MFS and its process supervisor
  before cleanup returns.

## Cleanup and Recovery

- Library removal cancels all work under the member root, removes index rows,
  derived artifacts, preparation records, ordering, runtime bindings, and
  membership, but never deletes the user folder. A process-local removal intent
  rejects concurrent reopen/register attempts, and durable membership is
  removed last so an interrupted cleanup remains recoverable by reconcile. It
  invalidates queued folder-sync generations before cleanup and interrupts an
  active MFS operation; concurrent status polls treat that short
  retirement window as transitional instead of surfacing a daemon-close error.
  Because the daemon is process-wide, the same retirement may interrupt a
  concurrent reconcile for another live member; that authoritative operation
  retries once from bind after replacement readiness instead of surfacing an
  expected lifecycle 500.
- Source delete removes its derived text, manifests, resumable work, playback
  preview, attention rows, and index rows.
- Move/rename retires the old source identity. The new DocumentId is an MFS
  upsert and may require embedding; prepared formats clean old ownership and
  prepare under the new path.
- Reprocess validates optional dependencies before destructive reset, clears
  stale final output and attention, and queues interactive work. Media manual
  retry clears inference checkpoints but may retain a current model-independent
  playback preview.
- A missing native helper, model, or optional state store degrades to warning,
  blocked, or retryable status. It never blocks source browsing.
- A source development runtime prefers the repository's live Python environment
  and helper scripts even when Electron serves a built renderer without Vite.
  Packaged launches instead resolve only their explicit bundled runtime paths.
- Startup recovery runs only after the process owns the server port, preventing
  a losing startup contender from deleting the active owner's temporary work.

## Resource Bounds

These constants are review-significant because they define liveness or memory
contracts, not because every tuning value belongs in prose:

- scheduler capacity is two light tasks, one heavy task, and four classifier
  tasks; background work ages after `60 s` but never above active-folder
  urgency;
- Node folder listing and Preparation discovery yield after at most `2,048`
  visited directory entries;
- direct-text semantic admission is capped at `8 MiB` per source in both Node
  and Python;
- media transcription uses ten-minute durable work units with `1.5 s` overlap;
- durable DOCX extraction has a `60 s` worker deadline;
Keep the Node/Python admission bound synchronized. A change to capacity,
chunking, or deadlines requires the focused liveness tests and an explanation
of the resource tradeoff.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Scheduling Interface | `ConversionScheduler` in `server/conversion-scheduler.ts` |
| Format dispatch Interface | `server/conversion-dispatch.ts` and `server/conversion.ts` |
| Reconcile owner | `server/sync.ts` and `server/state.ts` |
| Index Interface | `IndexerStatus` and the rest of `server/indexer.ts`, implemented by `server/indexer.mfs.ts` |
| Folder status contract | `IndexStatus` in `shared/index-status.ts`, built by `buildIndexStatus` in `server/index-status.ts` — a superset of `IndexerStatus`, not the same type |
| Daemon Adapter | `server/mfs-daemon.ts` ↔ `python/stashbase_daemon.py` |
| Retrieval Interface | `server/retrieval/index.ts`, with keyword, semantic, and evidence Modules beside it |
| Format owners | PDF, OCR, DOCX, and audio Modules under `server/` plus their native/Python Adapters |
| Focused evidence | `server/conversion-scheduler.test.ts`, `server/conversion.test.ts`, `server/conversion-status.test.ts`, `server/extractor-process.test.ts`, `server/semantic-index-inputs.test.ts`, `server/index-status.test.ts`, `server/indexer-mfs-path.test.ts`, `server/audio-transcription.test.ts`, `server/retrieval/index.test.ts`, `scripts/semantic-retrieval-metrics.test.ts`, `scripts/semantic-retrieval-dataset.test.ts`, `scripts/semantic-retrieval-runner.test.ts`, the versioned `evals/semantic-retrieval/` AI Eval, and `python/stashbase_daemon_test.py` |

## Review Checklist

- Is completion explicit and format-specific?
- Can stale or partial output be read during queue wait, retry, or source
  replacement?
- Can lost process memory leave work permanently stuck?
- Is cancellation classified as user intent or transient interruption?
- Does folder-explicit work avoid the current-window dependency?
- Can cleanup delete a user source or an ambiguously owned destination?
- Are expensive filesystem, hashing, parsing, and native operations bounded off
  the Node event loop?
- Does the UI treat status as explanation rather than truth?

## Validation

Run:

```bash
pnpm typecheck
pnpm test:conversion-scheduler
pnpm test:retrieval
pnpm test:python
```

Run `pnpm eval:semantic-retrieval` as a credentialed release check when a
change can affect semantic ranking, chunking, or the embedding provider. This
probabilistic Eval is not a substitute for the deterministic commands above.
Retain the full report (`--out <path>`) and do not treat thresholds as gating
while it reports `CALIBRATION`; activation requires the baseline policy
documented with the versioned dataset. `pnpm test:retrieval` validates the
dataset manifest against its fixtures without credentials.

Add `pnpm test:library-files` for mutation/reconcile changes and
`pnpm test:electron:smoke` when native process or store retirement changes.

Related journeys: [J02](../design-docs/user-journeys.md#j02-add-and-open-a-folder),
[J04](../design-docs/user-journeys.md#j04-prepare-a-hard-to-read-file),
[J05](../design-docs/user-journeys.md#j05-search-and-open-source-evidence), and
[J08](../design-docs/user-journeys.md#j08-connect-an-external-agent-through-mcp),
plus the [J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop and
[J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project)
for registration and initial sync of an Agent-created member, and
[J12](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder)
for Wiki Page admission and independent activation of search by meaning.
Related contracts: [File Transactions](file-transactions.md),
[MCP Access](mcp-access.md), and [Release Pipeline](release-pipeline.md).

# Migration to liliu-z/mfs

Research date: 2026-09-14. Status: implemented in the accompanying working
tree; validation evidence is recorded below.

Compared StashBase `ff42918fa349c087c7de01cebc55d4ace25a0e8e` with MFS
[`9856ef95a713a6456a3832b106f0a3786037fdcc`](https://github.com/liliu-z/mfs/tree/9856ef95a713a6456a3832b106f0a3786037fdcc).
The migration writes new index state below `vector-store.nosync/mfs-v2` and
uses MFS document status as its only accepted-projection catalog. It does not
open or delete the legacy `milvus.db`, user sources, or prepared artifacts.

## Recommendation

The application now uses the embedded MFS public API behind the existing Python process
boundary. Use one MFS instance per daemon and one stable Internal search
projection namespace per Library Folder. StashBase continues to own filesystem
observation, searchable-text preparation and freshness, including media
transcription and every user-visible prepared artifact. It gives MFS only the
completed searchable representation. MFS owns chunking, embedding, ranked
index publication and retrieval for that projection.

This use of an Internal namespace is supported by the MFS core design, but it
intentionally differs from the upstream StashBase integration recommendation,
which proposes an External namespace and MFS-invoked Processors. The difference
is deliberate: the transcript is a StashBase product artifact that must exist
independently of indexing and be available to the viewer and Agent reads before
or without MFS ranking.

This is a lifecycle migration, not a package rename. The upstream
[StashBase integration contract](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/docs/stashbase-integration.md)
describes this destination but predates this StashBase cutover. The exact
revision remains pinned. Its failing upstream CI is an accepted integration
risk for this cut and remains a release limitation until resolved upstream or
superseded by a reviewed revision.

## Alignment with MFS design

| Decision | Relationship to MFS design |
|---|---|
| One namespace per selected Folder and no cross-namespace query | **Aligned.** Search always names one namespace, and nested Library members remain independent |
| Public `upsert`, `remove`, `list_document_statuses`, `search`, `grep`, `wait`, configuration, and close APIs only | **Aligned.** StashBase no longer reads MFS tables, patches Milvus, or maintains an alternate projection catalog |
| MFS owns projection hashes, revisions, unchanged outcomes, processing, chunking, embedding, publication, and ranked retrieval | **Aligned.** The application consumes MFS mutation/status results instead of reproducing them |
| A StashBase OpenAI-compatible Embedder supplies BYOK policy | **Aligned.** MFS defines the Embedder protocol while credentials and provider policy remain host concerns |
| Internal namespaces receive completed product text | **Supported by core MFS, but different from the upstream StashBase recommendation.** Upstream recommends External namespaces and MFS-invoked Processors |
| StashBase enumerates files and prepares PDF/OCR/DOCX/transcript text | **Different from the recommended External flow.** Product-visible prepared artifacts and media lifecycle must exist before and without MFS, so MFS cannot observe the authoritative input in this integration |
| Exact search uses MFS `grep` over accepted text revisions | **Aligned.** MFS owns literal matching, smart case, whole-word checks, scope filters, and global work budgets; StashBase only formats source-visible snippets and locators |
| File transactions, admission rules, readiness aggregation, and reconcile triggers remain in Node | **Outside MFS ownership by design.** They authorize and explain product state rather than index state |

## Current coupling and target mapping

Before this cut, dependencies requested `mfs-cli[onnx]>=0.1.0`. The daemon directly used
the old scanner, chunker and Milvus store, including private queries and
runtime patches. All folders shared an active provider/dimension collection;
paths were absolute. Node now owns preparation scheduling and offers complete
admitted projections; MFS owns their content revisions and synchronous
mutation outcomes.
Sources: [requirements](../python/requirements.txt),
[daemon](../python/stashbase_daemon.py), [index interface](../server/indexer.ts),
[adapter](../server/indexer.mfs.ts), [sync](../server/sync.ts).

| Existing application behavior | Migration mapping | Consequence |
|---|---|---|
| Bind an absolute folder root | Create/open an Internal namespace using the Folder comparison identity | The absolute root remains StashBase authorization/configuration; MFS document IDs are folder-relative visible source identities |
| Hash-scan, then push direct file text | Enumerate admitted sources and offer every complete direct projection to `upsert` | MFS hashes the projection and returns `added`, `updated`, or `unchanged`; StashBase keeps no duplicate projection hash catalog |
| Push completed prepared content with a host hash | `upsert(namespace, visible_source_id, prepared_text)` after the format owner accepts the product artifact as current | Media bytes and incomplete transcripts never enter MFS; MFS receives and hashes only completed product text |
| Delete/rename rows directly | Mutate disk through the existing transaction, then `remove` the old projection and `upsert` the new projection when available | Reconcile repairs a crash between disk and projection changes; indexing failure never rolls back a valid disk mutation |
| Folder semantic search | Explicit namespace `search(..., mode="hybrid")` | Map namespace-relative identity and source locations back to visible source hits |
| Whole-library search | Retire it; every exact or ranked query selects one folder namespace | This matches MFS's deliberate single-namespace query contract |
| Public keyword search | MFS `grep` with `TextMatch`, path/extension filters, and bounded work | Exact retrieval works with namespace vector indexing off and does not require BYOK |
| Status/list files | `list_document_statuses` plus StashBase preparation/source state | MFS status is authoritative for accepted projections; text preparation and index readiness remain distinct |
| Manual Sync / MCP reindex | StashBase observes and prepares current sources, then reconciles Internal projections; MFS `reindex` only repairs accepted projections | Product Sync remains broader than the MFS method named `reindex` |
| Embedding setup/change | Bind custom Embedder; use `configure_namespace` for changes | Model identity is embedding space plus dimension; key rotation must not imply a rebuild |
| Close/reset daemon | MFS `close(timeout=...)`, then actual process retirement | Preserve the existing single-flight generation and lock-release barrier |

API sources: [MFS facade](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/src/mfs/_core.py),
[public types](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/src/mfs/types.py),
[integration contract](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/docs/stashbase-integration.md).

## Implemented integration decisions

### Processing and capacity

StashBase retains the complete extraction operation, including PDF/OCR/DOCX,
media transcription, resumable work units, user-visible transcripts and
playback previews. After an artifact is atomically complete and its format-
specific freshness and preparation configuration are current, the application upserts its text
into the folder's Internal MFS namespace. A small pass-through Processor turns
the accepted text into a processed document and SourceMap; it performs no
media extraction.

This avoids the unsafe External-Processor bridge described upstream. MFS never
observes an unprepared media target, waits for Node, or receives an unconditional
retry notification that could clear cancellation. Preparation cancellation and
retry stay in the StashBase scheduler; MFS cancellation applies only to the
accepted projection's chunk/embed/publish task.

StashBase must still coordinate native playback and preparation capacity. MFS
embedding runs independently; provider batching and rate limiting belong to the
bound Embedder. There is no reason to share the preparation heavy lane with an
MFS media Processor because no such Processor exists in this integration.
Sources: [upstream integration contract](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/docs/stashbase-integration.md),
[current preparation contract](../code-review/data-lifecycle.md).

The JSON-lines dispatcher accepts bounded concurrent requests with
ID-correlated, serialized responses so an MFS wait does not prevent an
independent status request from entering the adapter. Process retirement is
still the cancellation boundary for a call already executing inside MFS.
Sources: [daemon](../python/stashbase_daemon.py),
[process manager](../server/mfs-daemon.ts),
[upstream integration contract](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/docs/stashbase-integration.md).

### Retrieval parity

Every exact and ranked query must select one Library Folder and therefore one
namespace. Retire `scope: "library"`, whole-library fan-out, cross-folder score
merging, and silent broadening after an empty result. A Chat without a folder
cannot retrieve until it is attributed to one; an external client must select
one authorized folder. Nested member folders remain independent, so selecting
the parent and selecting the child can legitimately observe separate MFS
document identities for the same physical source.

Upstream's default chunker uses 4,096-byte windows with 512-byte overlap. The old
daemon relies on Markdown-aware chunks and heading metadata. Implement an
explicit compatible chunker/source-map adapter or accept a measured ranking and
locator change; do not promise unchanged headings, page/line jumps, or recall.
Sources: [upstream adapters](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/src/mfs/adapters.py),
[search result contract](../shared/search-results.ts),
[semantic evidence](../server/retrieval/semantic.ts),
[product search contract](../design-docs/design/search.md).

### Filesystem mutations and crash recovery

Retain the existing mutation owner, path locks, preparation/playback retirement,
link-cascade rollback, and source transaction recovery. MFS does not read the
external source in this design, so source mutation does not need an MFS scope
lease. After the disk transaction commits, remove the old Internal projection
and enqueue the new projection when current text exists. The replacement is
offered again even when the bytes are unchanged, so MFS owns whether its
bounded cache can reuse prior work; semantic indexing failure reports lag and
must not reverse a successful rename.

Reconcile is the recovery boundary for a crash between the source mutation and
the Internal projection update. It enumerates StashBase-admitted sources,
compares their identities with MFS document status, and replays idempotent
upsert/remove work. MFS compares the offered projection bytes with its current
revision. A rename may re-embed because Internal documents do not use External
rename observation; zero re-embedding is not a product guarantee.
Sources: [mutation owner](../server/library-file-mutations.ts),
[file transaction contract](../code-review/file-transactions.md),
[upstream integration contract](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/docs/stashbase-integration.md).

## StashBase capabilities outside native MFS support

This inventory distinguishes a missing application capability from an MFS
defect. MFS supplies storage, observation, processing, indexing, and
single-namespace retrieval primitives. It does not aim to own the product,
filesystem transaction, credential, or viewer policies below.

| Current StashBase capability | What MFS provides | Retention decision |
|---|---|---|
| Enhanced PDF extraction, image OCR, sanitized DOCX HTML, HTML flattening, and audio/video transcription | Built-in UTF-8, PDF, and basic DOCX processors plus the custom Processor protocol; no OCR, transcription, StashBase HTML transform, or sanitized preview HTML | **Retain entirely in StashBase Preparation.** Give MFS only the completed validated text through a pass-through Processor |
| Timestamped transcription with ten-minute resumable units and overlap reconciliation | Generic ProcessingContext progress and checkpoints exist, but this integration does not ask MFS to process media | **Retain entirely in StashBase.** Its transcript is a user-visible product artifact and remains useful without ranking |
| Browser-compatible audio preview and interactive playback fallback | Artifacts and shared resource admission are available, but playback conversion and viewer handoff are explicitly host responsibilities | **Retain in StashBase.** It must stay independently usable when searchable-text preparation fails or is cancelled |
| Interactive-preview priority can hand a same-source heavy lane from transcription to playback, then resume durable checkpoints | MFS has no StashBase-specific preview request or viewer lifecycle, and does not run either media task in this integration | **Retain as StashBase host coordination.** It stays within the existing preparation/playback scheduler |
| Literal exact-search results grouped by file and line, smart case, Unicode whole-word filtering, highlighted ranges, bounded snippets, PDF pages, and audio timestamps | `grep` supplies literal matching, structural filters, total byte/document/match budgets, failures, and SourceMap locations | **Move retrieval into MFS.** Accept one 500-match namespace budget instead of the former 50-per-file distribution; retain only product result formatting and page/timestamp mapping |
| Search-type categories such as notes, documents, images, and media | `ByExtension` and `ByMediaType`, not StashBase category names | **Retain only the category mapping.** MFS can enforce the resulting filters before top-k |
| Source-visible result identity, legacy-derived remapping, and click-through into the correct preview | Namespace-relative DocumentId and SourceLocation | **Retain the product mapping.** Hidden managed text/chunks must never become a visible result |
| `read_file` returns current prepared PDF/DOCX/transcript text and supports explicit bounded line windows | `read(DocumentId)` returns a complete current processed Document; artifact handles are available | **Retain the Agent/MCP read interface and its size/window policy.** It is file access, not ranked retrieval |
| Large first-index estimation and the user's Start/Not now decision | Namespace indexing can be paused or switched off; MFS does not estimate StashBase workloads or own the prompt | **Defer.** Do not carry this product decision into the initial cut. A Folder configured for search by meaning accepts completed projections immediately |
| OpenAI/OpenRouter BYOK credentials, batching, retries, provider availability, and billing copy | Generic Embedder protocol and task failure; MFS never persists credentials or defines provider policy | **Retain.** Implement these in the bound Embedder and Settings-owned server state |
| Account-hosted embedding, quota, purpose headers, and 402-driven suspension | MFS isolates grep/read from ranking but does not understand StashBase accounts or allowance | **Retired.** Search by meaning is BYOK-only and account credits belong to OpenQuill |
| Folder sync triggers on boot, entry, focus return, manual Sync, MCP reindex, and Agent turn completion | Internal MFS namespaces do not observe the filesystem | **Retain the triggers and admission walk.** They decide which projections to offer or remove; MFS decides whether offered content changed |
| Conditional note bundles, legacy hidden-derived paths, project-directory exclusions, cloud placeholders, and format admission | Internal upsert accepts document IDs/content selected by the host; MFS need not discover these filesystem relationships | **Retain as the StashBase projection admission policy.** Only admitted visible-source IDs are upserted |
| Invalid UTF-8 TXT stays visible but is not decoded lossily or treated as a preparation problem | Internal MFS receives only host-admitted text and therefore need not see the invalid source | **Retain the product classification.** Reject it before projection upsert and remove any stale projection |
| Empty OCR is a successful, non-searchable preparation result | Empty processed text and a zero-chunk publication are representable | **Retain in Preparation.** Remove any old MFS projection and do not turn it into an indexing failure |
| Source mutation authorization, path containment, version conflicts, atomic imports, link cascades, rollback, and remove-member-without-deleting-source | Internal upsert/remove manages only the search projection; MFS intentionally does not mutate external sources or authorize callers | **Retain in StashBase.** Reconcile projection state after the source transaction |
| Unsaved encrypted draft journal | No corresponding MFS feature, by design | **Retain entirely outside MFS.** It must remain excluded from sync and retrieval |
| Viewer handles, tab lifecycle, clipboard screenshot opt-in/import, and source previews | No corresponding product/UI feature, by design | **Retain entirely outside MFS.** Accepted screenshots become ordinary sources before MFS observes them |
| Folder-level readiness copy combining embedding state, preparation progress, failures, and provider health | MFS reports projection indexing state only; StashBase preparation remains an independent authority | **Retain the aggregation and current preparation status.** Remove only fields that duplicate MFS chunk/embed/publish state |

## Deferred TODO

- Decide after the migration whether StashBase needs a Folder-scoped estimate
  and cost/latency control for unusually large first indexes. If it does, build
  it on MFS namespace indexing configuration. This is outside the initial cut
  and does not preserve the current Start/Not now prompt.
The following former mechanisms are removed rather than preserved:

- the daemon's private `mfs.store`, Scanner and Milvus access, collection
  discovery, and runtime monkey patches;
- the old daemon wire implementation behind `upsertFile`/`deleteFile`/rename;
  replace it with public Internal `upsert`/`remove` projection operations and
  model rename as remove plus a later upsert;
- the promise that a rename performs zero embedding; MFS cache reuse is an
  optimization with a bounded, namespace-specific cache;
- whole-library exact and ranked search, `scope: "library"`, and any empty-result
  scope expansion;
- the Node ripgrep process, derived-text search walk, per-file exact-match cap,
  packaged ripgrep binaries, and their platform dependencies; MFS `grep` owns
  exact matching over the same accepted projection used for ranked retrieval;
- account-hosted search-by-meaning and its quota/broker path, as already required
  by the Search and Settings Known Gaps;
- retired local-ONNX selection plumbing and legacy hidden-derived artifacts
  after their migration/cleanup window.

The following are upstream or integration readiness gaps rather than
StashBase product capabilities:

- the pinned revision's managed-process/frozen-supervisor failures on macOS and
  Linux and its Windows type-check failure;
- BACKEND-005, where Milvus Lite BM25 order depends on flush boundaries;
- the absence of a batch Internal-namespace upsert or content-revision
  preflight. Reconcile must offer every admitted direct-text projection to
  MFS. Unchanged content spends no embedding tokens, but still incurs a Node
  read, JSON transfer, and MFS stage/hash operation;
- the frozen dependency footprint. The current macOS arm64 daemon is about
  214 MiB because MFS's Milvus/PyArrow/Pandas stack is bundled. Fresh-build
  cold launches took roughly 36–60 seconds in this checkout; subsequent
  launches were subsecond. The 90-second daemon readiness barrier
  passed, but release checks still need representative cold starts on every
  packaged platform.

## Existing data migration

The adapter opens a separate versioned `mfs-v2` AppData directory and never
opens the legacy Milvus database as an MFS catalog. MFS's own namespace
migration API is therefore not misused as a StashBase raw-row importer.

Folder comparison identity deterministically derives the Internal namespace;
there is no separate projection ledger. Normal authoritative reconcile
enumerates StashBase-admitted sources, reads accepted DocumentIds from MFS, and
offers direct or current prepared projections. Without BYOK the namespace uses
`indexing="off"`, so those projections remain available to exact search without
calling an embedding provider.
Preparation failure/cancellation stays in the application database. Settings
keys, user sources, chats, prepared artifacts, and unsaved draft journals
remain untouched. Vectors rebuild instead of attempting an unsupported raw-row
import.

Admission remains application-owned: hidden bundles, project exclusions,
extension routes, cloud placeholders, text decoding, and preparation freshness
define the visible-source set handed to MFS exact and ranked retrieval. The
projection size limit applies to prepared text, not to the PDF/media source
bytes that MFS never receives. Sources: [upstream integration contract](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/docs/stashbase-integration.md),
[data lifecycle](../code-review/data-lifecycle.md),
[Settings ownership](../code-review/settings-config.md).

## Dependency and release gates

New MFS requires Python `>=3.13,<3.14`; local setup now requires Python 3.13,
replaces an incompatible existing venv, uninstalls the retired distribution,
and probes `mfs.MFS`. The dependency is pinned to the reviewed commit because
the old and new distributions both supply the `mfs` import namespace. Setup,
packaging assertions, and PyInstaller metadata changed together.

The new package pins Milvus Lite 3.2.1, pymilvus 3.0.1, and pymupdf4llm 1.28.2.
The PDF dependency conflicts with assumptions behind the current lightweight
daemon bundle and must be measured or made optional upstream. It does not ship
the old `mfs.embedder.onnx` adapter; remove obsolete packaging references while
preserving the application's retired-local-source migration behavior. Frozen
process supervision needs its documented early dispatch entry and bundled
supervisor module. Sources: [upstream dependency manifest](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/pyproject.toml),
[setup](../scripts/setup-python.mjs), [sidecar builder](../scripts/build-python-sidecar.mjs),
[Settings contract](../code-review/settings-config.md).

The exact target revision's [CI run](https://github.com/liliu-z/mfs/actions/runs/34795295530)
is failing on all three platforms:

- macOS and Linux each report 3 failed, 215 passed, 3 skipped, 1 xfailed.
  Failures concern host-kill child retirement, frozen supervisor dispatch, and
  stage deadline failure classification.
- Windows reports 31 type errors, including POSIX-only process APIs; its test
  step was skipped. This is not evidence that Windows runtime tests pass.
- Separately, upstream records BACKEND-005: Milvus Lite BM25 ranking depends on
  segment flush boundaries, covered by strict xfail. Resolve or explicitly
  accept its retrieval-quality impact after representative evaluation.
  Source: [upstream backlog](https://github.com/liliu-z/mfs/blob/9856ef95a713a6456a3832b106f0a3786037fdcc/docs/backlog.md).

## Implemented sequence and acceptance

### StashBase code-volume snapshot

This snapshot counts only StashBase-authored production TypeScript,
JavaScript, Python, and shell sources. It excludes tests, documentation,
generated/package output, virtual environments, and the upstream MFS source.
Against `ff42918fa349c087c7de01cebc55d4ace25a0e8e`, the migration tree changes
from 111,987 to 109,110 lines: 2,877 fewer lines (2.6%). The narrow indexing
core changes from 3,769 to 2,045 lines: 1,724 fewer (45.7%); the Python daemon
changes from 1,982 to 780 lines: 1,202 fewer (60.6%). The former 421-line Node
exact-search implementation is gone together with its ripgrep packaging.

The whole-product percentage is smaller because source admission, preparation,
media playback/transcription, file transactions, viewers, Agent/MCP policy,
and result presentation remain StashBase responsibilities by design.

1. **Pin the reviewed upstream revision.** The dependency is immutable and
   Python 3.13 compatibility is enforced locally. Upstream CI remains the
   release limitation recorded above.
2. **Integrate a direct-text vertical slice in isolated state.** One Internal
   namespace, a pass-through text Processor, custom Embedder, concurrent RPC,
   status, and public upsert/remove calls. Keep admission in StashBase, let MFS
   own projection hashing, and keep the existing public search/read shapes.
3. **Complete source lifecycle and folder-scoped retrieval.** Mutation
   projection reconcile recovery, nested-folder identity, source-hit mapping,
   filters, and partial failures. Remove whole-library scope from UI, Chat,
   HTTP, and MCP before expanding rollout.
4. **Connect prepared formats at their completion boundary.** Existing
   format implementations, completion/freshness rules, checkpoints,
   cancellation, preview artifacts and native capacity. Upsert only a current
   complete text projection; remove stale and empty projections. Update
   preparation, search, and status evidence.
5. **Cut over without raw-row import.** The old dependency, private store
   queries, local embedder, hosted embedding broker, whole-Library search, and
   large-index decision path are retired. Reconcile rebuilds accepted
   projections in isolated MFS state.

Affected journeys are J02, J04, J05 and J08, composed by J10. Update owning
product and review contracts with each implementation slice, including
[journey coverage](../code-review/journey-coverage.md); this research does not
relabel proposed behavior as Shipping.

Focused validation should cover external edit while processing, stale-projection
invalidation before replacement, no-key reads/cleanup, nested folders, empty OCR,
CRLF/UTF-8 locators, cancel versus retry, config rotation, provider failure,
daemon respawn, disk-operation crash recovery, and remove-folder without source
deletion. Run `pnpm test:python`, `pnpm test:conversion-scheduler`,
`pnpm test:retrieval`, `pnpm test:library-files`, and crossed Settings/MCP gates.
Run the credentialed semantic retrieval eval for chunking/ranking changes.
Before committing implementation, run the repository's applicable gates.
Electron launches must remove `ELECTRON_RUN_AS_NODE`; the frozen sidecar is
also exercised directly in this source checkout.

## Validation completed

The migration was validated in this checkout on macOS with Python 3.13.7 and
the pinned MFS revision:

- the Python adapter suite passed 22 tests, including Folder namespace and
  document identity, MFS mutation outcomes, rename/nesting, filters, search,
  no-key exact retrieval, key removal/restoration, OpenRouter configuration,
  and concurrent stdin dispatch;
- the frozen PyInstaller sidecar built successfully, answered a no-key
  readiness smoke from `mfs-v2`, completed a direct-text upsert and MFS `grep`
  without an embedding provider, completed hybrid retrieval against a
  deterministic local OpenAI-compatible embedding server, and reconfigured an
  existing no-key namespace after BYOK became available;
- conversion scheduling passed 171 tests, Library file and sync behavior 66,
  retrieval 23, MCP 16, configuration 51, and shared HTTP protocols 113;
- the running desktop server reconciled the built-in Start Here Folder and
  returned 109 untruncated `StashBase` matches from visible sources through
  `/api/library/keyword-search`, exercising the live Node-to-MFS exact path;
- all 1,621 renderer tests passed, followed by all 11 `check:web` gates;
- package-input assertions passed 8 tests, documentation and test inventory
  checks passed, and the replacement Electron boundary smoke passed with
  `ELECTRON_RUN_AS_NODE` removed.

No production provider credential was used, so this evidence establishes the
integration lifecycle and wire behavior but does not establish ranking quality,
provider latency/cost, or recall parity on a representative user corpus.

## Evidence limits

This assessment uses pinned upstream source, current StashBase source/contracts,
and the exact upstream CI logs. Local deterministic validation does not claim
real-provider retrieval parity or packaged-platform readiness across all
supported operating systems.

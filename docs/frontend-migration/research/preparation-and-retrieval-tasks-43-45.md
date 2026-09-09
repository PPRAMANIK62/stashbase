# Preparation and semantic retrieval research for Tasks 43–45

Research date: 2026-09-09

## Scope

This note pins what the replacement renderer must build for Task 43
(Preparation status), Task 44 (Preparation controls and capture), and Task 45
(semantic retrieval). It records the server contracts those tasks consume, the
legacy renderer behavior they replace, what the replacement already has, and
the implementation decisions each task should take. It does not describe
Shipping behavior; the permanent record stays in `design-docs/` and
`code-review/`.

Product intent: [Preparation](../../../design-docs/design/preparation.md),
[Search and Retrieval](../../../design-docs/design/search.md), journeys
[J04](../../../design-docs/user-journeys.md#j04-prepare-a-hard-to-read-file)
and [J05](../../../design-docs/user-journeys.md#j05-search-and-open-source-evidence).
Engineering contracts: [Data Lifecycle](../../../code-review/data-lifecycle.md)
and [Settings and Config](../../../code-review/settings-config.md).

## What the replacement renderer has today

- No `features/preparation` folder. The target architecture names it as the
  owner of derived-state status and controls.
- Nothing reads `GET /api/index-status`. There is no protocol schema for it,
  no polling, and no tree refresh after external filesystem writes. The
  legacy renderer drove both from that one poll.
- The file tree marks only restricted and generic entries.
- PDF and image viewers say nothing about searchable text. DOCX shows a single
  fallback line when the direct preview fails.
- The media viewer from Task 40 already polls `GET /api/audio/transcript`
  with pending and blocked cadences, and already offers cancel and reprocess
  through `MediaApi`. Task 44 must reuse that rather than add a second path.
- `features/retrieval` is exact search and Quick Open only. The exact-search
  adapter passes an `AbortSignal` to the HTTP client, so semantic search can
  be genuinely abortable at the fetch layer. The legacy renderer never
  cancelled a search request.
- Settings shows AI Index, Transcription, and General as "Soon" sections.
- The replacement Electron bridge exposes no clipboard channel. The main-side
  clipboard monitor was removed when the replacement boundary was
  established; only the policy module and the legacy preload bridge remain.

## Server contracts

### Folder status (Tasks 43, 45)

`GET /api/index-status?folder=` returns `IndexStatus` from
`shared/index-status.ts`. Explicit `folder` bypasses the per-window folder
gate. The fields split cleanly into two concerns:

| Concern | Fields |
|---|---|
| Preparation | `pendingConversions`, `blockedConversions`, `conversionProgress` (queued, yielded, extracting with page or unit counts, indexing), `conversionRevision`, `conversionVersions`, `preparationFailures` (`failed` or `cancelled`, with `lastError` and `attempts`) |
| AI Index | `semanticEnabled`, `semanticAvailable`, `semanticDisabledReason`, `semanticIndexing.state` plus `sourceCount` and `estimatedBytes`, `pending`, `visibleIndexingSettled`, `indexReady`, `indexWarning` |
| Shared | `treeVersion` (bumps on every external filesystem event), `folder`, `total`, `indexed` |

Notes:

- `pending` is empty whenever semantic indexing is unavailable, so it never
  describes preparation work.
- There is no "stale" state on the wire. A changed source invalidates its
  output and reappears as pending.
- `GET /api/pdf/status` has no callers in the legacy renderer. All per-file
  preparation state comes from the folder status.
- Status polls during folder removal return a neutral transitional snapshot
  rather than a 500.

### Preparation controls (Task 44)

| Route | Body | Result | Notes |
|---|---|---|---|
| `POST /api/files/prepare` | `path`, `folder?` | `{ ok }` | DOCX and media only; PDF and image answer 415. Promotes an existing queued task to interactive priority. Non-destructive. |
| `POST /api/files/reprocess` | `path`, `folder?`, `language?` | `{ ok, mode: 'conversion' \| 'index' }` | Checks the optional-dependency block before any destructive reset; blocked audio answers 409 with code `TRANSCRIPTION_NOT_READY`. Convertible sources clear derived output and requeue; direct-text sources schedule a reconcile. `language` is audio-only and answers 400 when malformed. |
| `POST /api/files/cancel-preparation` | `path`, `folder?` | `{ ok, cancelled }` | Durable user cancel. Audio marks cancelled even when nothing is running. |
| `POST /api/index-warning/dismiss` | `folder?` | `{ ok }` | Clears the semantic index warning. |

Shared failure mapping: empty path 400, unknown explicit folder 404
`FOLDER_NOT_FOUND`, no folder at all 412 `NO_FOLDER`, path escape 400,
missing file 404 with the failure record cleared.

Transcription setup: `GET /api/transcription/settings`,
`PUT /api/transcription/preferences`, `POST /api/transcription/models/:id/download`
(202 while downloading), `DELETE /api/transcription/models/:id`.

Capture: `GET /api/capture` and `PUT /api/capture` own the durable
`capture.clipboardImageImport` preference, default false, non-boolean 400.

### Semantic search (Task 45)

Two routes exist. The library-wide one is the right target:

- `POST /api/library/search` with `query`, `top_k` (default 8), `folder?`,
  `path_prefix?`, `types?` (categories from `shared/search-types.ts`), and
  `mode` (default `semantic`). It answers before any folder is open and
  returns `{ hits, truncated? }` of `SearchHit`: `fileName`, `chunkIndex`,
  `content`, `heading`, `startLine?`, `endLine?`, `pdfPage?`, `score`.
  Hidden derived notes are remapped to their visible source or dropped.
- `POST /api/search` is folder-gated and is the only route that maps
  unavailability to HTTP: 402 `HOSTED_QUOTA_EXHAUSTED` and 412
  `EMBEDDER_KEY_REQUIRED`. The library route relies on the caller checking
  readiness first, which is what the legacy popup did.

Known gap to resolve before building: the library keyword route returns each
file with its owning `folder` and a folder-relative `path`, and the
replacement's `SourceReference` is built from that pair. The library semantic
route returns one `fileName` string that the legacy renderer split against
the folder roots client-side and dropped when it could not place it. Task 45
should extend the semantic evidence flattening on the server to emit the same
`folder` plus relative `path` pair so the renderer never re-derives identity.

There is no answer or streaming endpoint. Retrieval is pure, and `score` is
comparable only within one response. Semantic hits carry no audio timestamp.

Readiness decision: `POST /api/semantic-indexing/decision` with
`{ decision: 'start' | 'defer', folder? }`. `start` answers 202 and runs in
the background; anything else answers 400.

Embedding source: `GET /api/embedder` returns provider, key presence,
authorization, active source, model, and the hosted account state with quota.
`PUT /api/embedder/key`, `PUT /api/embedder/source`, `DELETE /api/embedder/key`,
and the account routes under `/api/account` own configuration. The renderer
only reads state and forwards explicit choices; credentials never live in the
renderer.

## Legacy behavior to carry over

### Status surfaces (Task 43)

- File-tree trailing icons for failed and cancelled sources only, with hover
  copy explaining searchability. Pending and blocked rows were unmarked.
- A "Needs attention" dot on the folder switcher when a failure, a blocked
  transcription, or an index warning exists.
- Viewer status lines: "Waiting to prepare searchable text…", "Waiting for
  other file preparation to finish…" when tasks are ahead, "Reading page N…",
  "Reading image text…", "Indexing searchable text…", and failure copy that
  keeps the source usable ("The image still opens normally.").
- A search-panel line: "N files are ready to search. M are still being
  prepared." with failed, cancelled, and transcription-setup variants.
- One poll: 1.5 s while conversions or semantic work are pending, 8 s idle,
  plus a throttled refresh on window focus. A `treeVersion` change reloads
  the listing, prunes tabs whose files vanished, and refreshes the active
  document from disk. `conversionVersions` bust derived-preview caches.

### Controls and capture (Task 44)

- Opening a DOCX or media source fires `prepare` once, fire-and-forget.
- Reprocess lives in the context menu for failed or cancelled rows and inline
  in PDF, image, DOCX, and media banners. Cancel is media-only while pending.
- Media reprocess offers a language select. Blocked media shows an "Open
  Settings" action into the Transcription section.
- Capture: Settings General shows "Offer to add clipboard screenshots".
  Enabling it asks Electron to refresh its watch; a mismatch reports "Saved,
  but the desktop capture service could not apply the change." The offer
  dialog reads "Add image to StashBase?" with Add and Dismiss. Add uploads
  through the ordinary import path as `clipboard-<timestamp>.png` into the
  active folder. Dismiss is final until the clipboard changes. The watch
  runs only while a StashBase window is focused, is suppressed while an
  Agent composer is focused, and fails closed when the setting cannot be
  read.
- Hidden derived notes: the server never lists `.name.ext.md` sidecars and
  refuses to open or save them. The renderer's only duty is to match a
  failure record spelled as a sidecar back to its source and never render a
  derived path.

### Semantic retrieval (Task 45)

- One search surface with Exact and Similar modes, whole-library scope by
  default, optional narrowing to one member folder. The legacy popup kept
  query, mode, and results across close and reopen.
- Readiness is checked client-side before searching. No source configured:
  "Set up AI Index to search by meaning. Exact text search works without AI
  Index." Hosted allowance exhausted: "Your hosted AI Index allowance is
  exhausted. Exact search is still available."
- Results preserve rank and group by folder when the scope is the library.
  Semantic rows show the snippet without term highlighting and the heading
  breadcrumb as locator. Activation opens the source with the chunk anchor
  and page, without switching the active folder.
- The AI Index notice appears for `awaiting-decision`, `paused`, and
  `partial-paused`: "Large AI Index workload" or "AI Index paused", the file
  count and estimated size, "Exact text search remains available.", with
  Build or Resume and Not now.
- Stale results were rejected with a generation counter. The replacement
  cancels at the query boundary instead.

## Task 43 — Present Preparation status and recovery

Build:

1. A new HTTP protocol schema beside the existing search one, validating the folder status
   response and the 412 rebind failure.
2. `features/preparation` with a pure per-source readiness projection
   (current, pending with phase, blocked, failed, cancelled) and a folder
   summary, both ignoring the AI Index fields. One status query under the
   workspace folder key with adaptive polling, focus refresh, and cancellation
   on folder retirement. Hooks for folder-level and per-source readiness.
3. Tree row markers for failed, cancelled, and blocked sources. The folder
   attention cue. Status lines in the PDF, image, and DOCX viewers. The
   exact-search readiness line.
4. Tree refresh from `treeVersion`, composed in the app shell because it
   crosses into the workspace feature.
5. Plan status and decisions in Subphase 4, and the Preparation ledger row
   moved from Not assessed to Building with every field filled.

Decisions:

- Pending sources are not marked in the tree. Pending state lives in the
  viewer and the folder summary. This follows the design rule that status
  appears only when it changes the next action, and matches legacy.
- The AI Index notice, paused and quota states, and the index warning belong
  to Task 45. Task 43 exposes the semantic fields through the same query but
  renders none of them.
- Failure banners land in Task 43 without their Reprocess action. Task 44
  follows immediately so no dead-end banner ships between them.

## Task 44 — Implement Preparation controls

Build:

1. Protocol schemas for prepare, reprocess, cancel, and the transcription
   settings and model routes. A `PreparationControlApi` port in the
   preparation feature; the media feature's existing cancel and reprocess
   calls migrate to it so one adapter owns these routes.
2. Reprocess in the tree context menu for failed or cancelled rows and inline
   in the PDF, image, and DOCX status lines. Cancel inline while a source is
   queued or running, not media-only, because the server already supports it
   for every convertible format. Prepare on open for DOCX and media through
   the document runtime.
3. Blocked media recovery: the 409 `TRANSCRIPTION_NOT_READY` reason renders
   as actionable copy with an Open Settings action. The Transcription
   Settings section becomes live: provider, model download with progress,
   remove, and language.
4. Capture: the General Settings section becomes live with the clipboard
   toggle. A typed Electron protocol under `shared/protocols/electron` for
   the offer, refresh, handled, and composer-focus channels. The main-side
   monitor is reintroduced from the pre-boundary implementation (focus-only
   poll, PNG hash dedup, fail-closed refresh against `GET /api/capture`,
   composer suppression through the existing policy module). The offer dialog
   composes in the app shell and imports through the workspace import path.
5. Hidden-derived-note guarantee as a renderer test: a failure record spelled
   as a sidecar resolves to its source row, and no derived path is ever
   rendered or opened.

Decisions:

- Localized recovery means the action sits where the state is shown. No
  global toast for reprocess; inline pending and error text, as the media
  viewer already does.
- Optimistic status after an action is not allowed. Reprocess and cancel
  refetch the folder status and the per-source query; the server remains
  completion truth.
- The Agent composer focus signal reuses the existing composer focus state
  from the agent feature through the shell rather than a new store.

## Task 45 — Implement semantic retrieval

Build:

1. Server: extend semantic evidence flattening so library search hits carry
   `folder` and folder-relative `path` alongside `fileName`. Protocol schemas
   for the semantic request and response, the readiness decision, and the
   embedder state.
2. Retrieval feature: a `SemanticSearchApi` port and adapter with real
   `AbortSignal` cancellation; a readiness projection over the semantic
   status fields (not set up, quota exhausted, awaiting decision, paused,
   indexing, partial, failed, ready) that maps each state to copy and to
   whether search may run; a mode switch in the existing search surface with
   Exact and Similar; grouped, rank-preserving result rows with heading
   locator and chunk anchor navigation through the existing open-document
   workflow.
3. The AI Index notice with Build, Resume, and Not now, and the index-warning
   line with Retry and Dismiss, composed where the search surface and sidebar
   already sit.
4. Settings AI Index section: hosted account summary with remaining allowance
   and reset date, sign in and sign out, BYOK key entry and removal, and the
   explicit active-source choice. Credentials stay server-side.
5. Ledger: Search and source navigation stays Building with the semantic
   evidence added; the Preparation row's AI Index separation is recorded.

Decisions:

- Readiness is read from the folder status query Task 43 introduces, not
  from a second embedder poll before every search. The embedder query is
  fetched for Settings and for the not-set-up explanation only.
- Scope defaults to the selected library folder, matching the Task 42
  decision, with a library-wide option. Cross-folder results open read-only
  without switching the active folder, as the product doc requires.
- Semantic result identity is the same `SourceReference` plus locator model
  exact search uses, so Task 50 can consume one readiness authority and one
  identity model.
- Unavailable states never collapse into one empty view. Each readiness
  state has its own copy and the Exact mode stays usable in all of them.

## Sequencing and open questions

Recommended order: 43, then 44, then 45, each as its own focused commit set.
Task 43 introduces the status query both later tasks read. Task 44 is mostly
adapters and inline actions plus the Electron capture reintroduction, which
is the only cross-process work in the three. Task 45 depends on the server
identity change and on the Settings sections going live.

Open questions for the maintainer:

- Whether to reintroduce the clipboard monitor in Task 44 or defer capture
  to the Electron finalization work. The J04 journey E2E depends on it, so
  deferring leaves J04 unprovable until it lands.
- Whether library-wide semantic scope should be the default, as the legacy
  popup did, or the selected folder, as Task 42 chose for exact search. This
  note assumes the selected folder for consistency.

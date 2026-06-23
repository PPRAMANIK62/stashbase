# Data Layer

> This document deals specifically with **the problems the underlying data must address**—how data is classified, who owns it, how the several copies stay consistent with one another, how it syncs, how it exports, how it is deleted and recovered.
>
> Division of labor with the other three documents: [overview](overview.md) covers "why", [use-cases](use-cases.md) covers "what the user can observe", [architecture](architecture.md) covers "how the system is built (modules / data flows / technical details)". This document does not repeat the directory layout, reconcile algorithm, or snapshot mechanism already written up in architecture; instead it takes the perspective of **the data itself**, threading these mechanisms into "the life of a piece of data", and explicitly recording **the trade-offs and boundaries that are not yet fully closed**. Anything about "how it is implemented" links back to architecture.

---

# 1. One thread running through the whole document

StashBase's data layer is essentially an **eventually-consistent reconciliation system**: the same piece of content exists in three representations, one of which gets rewritten by an uncontrolled external party.

```text
filesystem (source of truth)        ← external editors / git / cloud sync / scripts can all edit it directly
   │  reconcile
   ├──→ store/     (Milvus: chunks + vectors + per-file hash —— the sole authority on the per-file indexing fact)
   └──→ state.db   (conversion state only: single conversions table; the early files/index_queue two-table design has been removed)
```

Every data-layer problem derives from this diagram:

- **Who is authoritative**—the filesystem. The other two are derived, disposable and rebuildable ([§2](#2-data-classification-and-ownership)).
- **How do we know the derived layer has fallen behind**—reconcile, doing a diff at three levels of granularity ([§3](#3-consistency-model)).
- **After a rename / move, on what grounds do we recognize "it's still the same one"**—content-addressed hash, not path ([§4](#4-identity-and-stability)).
- **On a different machine, will this data still be recognized**—sync, in three tiers: intra-machine / cross-device / cloud ([§5](#5-sync)).
- **Leaving StashBase, does this data still live**—open formats + portable vector cache ([§6](#6-export-and-portability)).

---

# 2. Data classification and ownership

The first principle of the data layer: **every byte has one and only one authoritative source**. On this basis all on-disk content is sorted into four categories, deciding whether an agent may edit it, whether it can be rebuilt, and whether it should cross devices / enter git:

| Category | Examples | Source of truth (SoT) | Who can write | Rebuildable? | Cross-device sync | Into git |
|-|-|-|-|-|-|-|
| **Raw content / rules** | `paper.html`, `.md`, `paper.pdf`, images, `STASHBASE.md` | **Itself** (the filesystem) | User / agent (filesystem tools) | No—irreproducible data | **Yes** | Yes |
| **Derived index** | `store/` (Milvus), `state.db` | Derived from raw content | daemon / Node indexer only | **Yes**—delete it and it rebuilds on next open | No (rebuilt locally per machine) | No (`.gitignore`) |
| **App state** | `~/.stashbase/config.json` (kbRoot/recents/apiKey), `file-order.json` | Itself | Node | Partial (recents disposable, apiKey/kbRoot not) | No (one copy per machine) | No (contains secrets, `0600`) |

A few hard constraints follow from this:

- **Raw content and the derived layer are physically isolated**—the derived layer all lives under `.stashbase/` (one copy at the KB level + one at the space level). Deleting any `.stashbase/` layer loses no raw content ([architecture §3.3](architecture.md#33-derived-data-is-rebuildable)). This is the bedrock of the entire recovery model.
- **The agent does not modify the content of the user's raw files**—the agent does maintenance by creating new peer files (summaries / link notes), moving things to organize them, and editing files the agent itself generated; the files it creates can be tagged `generated_by` in in-file metadata for bulk identification.
- **Only one category truly needs backing up**: raw content / rules (the user's notes + `STASHBASE.md`). Everything else can be rebuilt after deletion. This compresses "how to back up StashBase" into one sentence: **treat the KB as a git repo and `.gitignore` `.stashbase/`, and that's enough**.

---

# 3. Consistency model

## 3.1 Consistency level: eventual consistency, no read-after-write guarantee

The write path **returns as soon as it hits disk**, with embedding running in the background ([architecture §4.2](architecture.md#42-processing-flow)). Therefore:

- A file is **visible / readable / editable immediately after it is written** (the filesystem layer is strongly consistent).
- But **content just written is not guaranteed to be immediately retrievable**—embedding takes seconds to tens of seconds, and **does not listen to the filesystem**; changes the agent writes via file tools must call MCP `reindex` to enter the index. If the agent wants write-then-read consistency, it calls `reindex` after writing (which runs reconcile and returns index status).
- The UI **explicitly exposes** this lag as an "indexing…" state (1.5s polling of `/api/index-status`; the pending list is computed by the daemon on the fly from the current board − Milvus reality), rather than pretending the sync is complete.

This is a **deliberate trade-off**: strong consistency would either block the UI (waiting for embedding) or introduce locks; for a low-write-frequency personal KB it isn't worth it. The cost is that the agent occasionally can't find something it just wrote—acceptable.

## 3.2 Where drift comes from and how it is detected

The derived layer falls behind the filesystem because **file changes don't go through the GUI's write path**: the agent writing via filesystem tools, external editors, `git checkout`, cloud sync landing, scripts. Detection = **a reconcile of content-hash diff** (`syncIndex` compares hashes across all files), triggered at **definite event points**: opening / switching a space, window refocus, end of an agent turn, manual Sync, MCP `reindex`. **It does not listen to the filesystem** ([architecture §4.6](architecture.md#46-reconcile)). The cost gradient inside the diff:

| Level | What is compared | Result | Cost |
|-|-|-|-|
| mtime+size | Metadata | "Possibly changed" candidates | one stat |
| content-hash | BLAKE3 full text | Content really changed, rename (hash pairs orphans) | re-embed only on a hit |

The entire trick of saving tokens is **not computing hashes lightly and not re-embedding lightly**: mtime/size changed but hash unchanged (`touch`/`cp -p`/`git checkout` of identical content) only updates metadata; path changed but hash unchanged (rename/move) only changes `source` and reuses the vectors ([§4](#4-identity-and-stability)).

## 3.3 The partial-failure state machine

A single ingestion is **multi-step and cross-process** (write to disk → extract resources → convert → chunk → embed → write store), and any step can fail. The two kinds of failure state have different destinations:

- **Index state is not persisted separately**—"which files are already indexed" is computed on the fly by the daemon from disk reality − Milvus reality (`scan_diff`/`status`); what is derivable doesn't go into state.db (the early `files` table was a write-only copy of it with no consumer, now removed—see the DROP comment in `server/state-db.ts:migrate`).
- **Conversion state is split by durability** (simplified 2026-06): **failed is persisted** (state.db `conversions` table, reason + `attempts`—the Retry surface must survive a restart, and a persistent failure must not be silently re-queued by the next discovery); **in-flight lives only in process memory** (`conversion-status.ts`—the converter is a child of this process, so the conversion dies with the process; persisting "in progress" only produces corpses); **done is not recorded**—the derived note on disk is itself the record. Converters therefore write temporary outputs and atomically replace the final derived note on success; a crash must not leave a half-written `.pdf.md` that reconcile would treat as done. PDF conversion additionally keeps a hidden per-batch resume cache next to the source (`.<source>.pdf.md.batches/`), validated by source size/mtime and batch parameters; it is not completion state, is excluded from semantic indexing, and only optimizes Retry / restart by skipping already-finished batches. The derived markdown carries hidden physical PDF page markers so search hits can return a precise `pdfPage` without guessing from book page numbers. Deleting a source while it is in-flight cancels the child extractor and clears the process-memory marker. Crash self-healing = no state to recover, and the next discovery re-judges by "source present ∧ note absent ∧ no failure record ∧ not currently converting". **Failures are not auto-retried**—bad files / scanned images / encryption are often persistent failures, and auto-retry would just hit the same failure; re-conversion is always user-initiated (the Retry button) ([architecture §4.3](architecture.md#43-pdf-conversion)).

**Why conversion state deserves a table while index state does not**: a conversion failure is invisible on disk (failed ≈ not yet converted), so not persisting it leads to repeated, money-burning retries; index state is visible in the store, so storing another copy would be a second source of truth. On space deletion, `deleteSpaceState` (`server/state-db.ts:235`) clears that space's conversions rows; otherwise orphan records would cause a same-named new file to be misjudged "already processed" and skip conversion—this kind of **silent error caused by orphan state** is the most insidious class of data-layer bug.

## 3.4 No cross-store transaction—a known risk window

`state.db` (SQLite, WAL) has transactions internally, but **there is no distributed transaction between `state.db` and `store/` (Milvus)**. So there is a theoretical window: the Milvus write succeeds, but the process crashes right before updating `state.db` → the two sides are briefly inconsistent.

The current fallback is not "prevent it from happening" but "make it harmless":

- **The next reconcile converges**—content-hash diff trusts neither side's "I think I've indexed it", and recomputes directly from disk truth. At worst the inconsistency left by a crash makes some file get re-embedded once next time (costing a few extra tokens); it never leaves incorrect retrieval results.
- **Conservative write order**—the state update ("indexed") always comes after the actual store write; better to "under-report indexed" (causing one redundant re-embed) than to "falsely report indexed" (causing missed retrieval).

> This boundary used to be worse: early on the `state.db.files` table and store reality were **two coexisting per-file sources of truth**, which could contradict each other across a crash boundary. The tightening done later was to simply remove the files table—the daemon's `scan_diff` (store reality) became the sole authority. But this class of "double-truth fork" problem hasn't disappeared, it just changed shape: inside the Node process there are still runtime cache copies like `MfsIndexer.spaceIndex` (see [§8.2](#82-runtime-copies-and-the-invalidation-protocol)), and the 2026-06-11 incident was exactly such a fork—"upsert returns ok (cache records it as indexed), but the store actually didn't get the write".

## 3.5 Concurrent writes

V1 does not introduce file locks (low write frequency). The same file edited at the same time by two write paths (two windows / MCP / external editor) → **the later writer overwrites** ([architecture §4.4](architecture.md#45-conflict-handling)). The app's writes via the API index directly in their own write path (no fs.watch, no loopback to speak of). The two write intents are treated differently: user drag-in = keep-both (add a suffix, never destroy anything existing); agent write = refuse to overwrite by default, requiring explicit `overwrite=true`.

---

# 4. Identity and stability

The data layer's second core problem: **on what grounds do we determine "this is still the same content"**. The path can change (rename, move, cross-device sync may reorder), so the path **cannot** serve as identity on its own. StashBase uses three layers of identity:

| Identity | Algorithm | Bound to | Solves what |
|-|-|-|-|
| **Path** `source` | KB-relative POSIX path | Location | Retrieval-result backlink, scope prefix filtering |
| **File content hash** `content_hash` | BLAKE3(full text) | Content | reconcile judging "did content really change", rename detection pairing orphans |
| **chunk text hash** `text_hash` | BLAKE3(chunk_text) | A single chunk's text | the hit key for snapshot vector reuse, natural dedup of identical text |

Key design: **the chunk primary key `id` is derived from path + line number + chunk hash**, so the moment the path changes the id changes—this is exactly why rename can't "edit path in place" and must go through a dedicated fast-path (reuse old vectors per chunk, only recompute id/source) ([architecture §5.6](architecture.md#56-incremental-update-ops)). Meanwhile the snapshot's hit key is deliberately **bound only to chunk text, not to path/line number**, so file moves, renames, and line-number drift don't affect vector reuse.

**The identity algorithm must lock-step BLAKE3 in three places** (Node / daemon / MFS scanner), otherwise `scan_diff` would judge every file as modified—this is a point where "algorithm choice is itself a correctness constraint".

> The boundary of dedup: identical **chunk text** is naturally deduped into one row inside the store (same `text_hash`); but **multiple copies of the same file** (the user dragged the same paper in twice) are not deduped across files—they are two `source`s, two sets of chunks. Cross-file content dedup is left to the agent's maintenance (the dedupe operation), not done automatically by the data layer. This is the consistent trade-off "the data layer only knows bytes; semantic judgment is left to the agent".

---

# 5. Sync

"Sync" has **three distinct levels** in StashBase, often conflated; you have to separate them to discuss it:

## 5.1 Intra-machine sync = reconcile (implemented)

The reconcile between filesystem ↔ derived index is exactly [§3.2](#32-where-drift-comes-from-and-how-it-is-detected). This is the only **automatic** sync in V1, and it **only watches the currently open space**—external changes to inactive spaces are not tracked in the background; reconcile discovers them when the user switches back ([architecture §3.4](architecture.md#34-external-tool-compatibility)). This "only watch the active space" is the landing point of the *Sees Only What You See* principle in the data layer: don't silently scan the whole library, don't silently burn embedding tokens.

## 5.2 Cross-device sync = the user's own external tool (V1's real path)

V1 has no built-in cross-device sync. Users who want to use the same KB on multiple machines rely on iCloud / Dropbox / Syncthing / git—and StashBase's data layout **is precisely designed to be compatible with them**:

- **Visible files (raw content / rules) sync normally**: they are all open-format ordinary files that any sync tool recognizes.
- **`.stashbase/` must be rebuilt locally per machine and explicitly excluded from sync**. Two hard reasons:
  1. **`store/` is Milvus Lite (a single-writer local DB file)**—simultaneous writes from multiple machines corrupt it, so it must never go on a sync drive.
  2. **`state.db`'s mtime baseline differs per machine**—syncing it over only manufactures false drift.
  (Likewise, when import folder brings a space in, the copy stage skips per-machine entries—`state.db-*`, `pdf-status.json`, etc., `import-folder.ts:isImportExcludedEntry`—and the cleanup prune is just a backstop.)
- **Cost**: each machine **rebuilds its own index** = re-embeds once each, paying the API cost repeatedly.
- **Bridge**: include the space-level `snapshot.parquet` (a pure vector cache, [architecture §5.7](architecture.md#57-snapshot-a-portable-embedding-cache)) in the sync; on import the other side reuses vectors on a `text_hash` hit and only truly embeds the missed chunks—this is V1's sole means of making "cross-device without re-burning tokens" hold.
- **Conflicts**: conflict copies produced by external sync tools (things like `file (conflicted copy).md`) are just a new file to StashBase, naturally absorbed by keep-both semantics and indexed individually—no data loss, but the user/agent needs to merge afterward.

## 5.3 Cloud sync (roadmap, not implemented)

overview §9 lists cloud sync as a commercialization direction. It "doesn't change the core model", but the **list of questions the data layer must answer** is worth recording now, to avoid reinventing them at design time:

| Question | Options and trade-offs |
|-|-|
| **Sync unit** | (a) Sync only raw files + snapshot—light, the other side rebuilds the index, but after the first sync the other side must import the snapshot; (b) sync `store/` too—no rebuild, but you must solve Milvus multi-machine write/merge, far heavier |
| **Conflict resolution** | last-write-wins (simple, may lose edits) / three-way merge (needs content awareness) / keep-both (reuses V1 semantics, most consistent) |
| **Encryption** | E2E (user holds the key, server has zero knowledge, best fit with *User-owned*) vs server-readable (can do server-side retrieval/dedup) |
| **Selective sync** | per-space granularity (a space is already an organizational unit, a natural sync switch) |
| **Index ownership** | Should the index be built once in the cloud and pushed down, or built locally per machine? The latter is more local-first but costs compute |

A leaning judgment (not settled): follow V1's data philosophy—**sync raw files + snapshot, rebuild the index locally per machine, conflicts go keep-both, E2E by default**—so that cloud sync is merely "productizing the Dropbox path the user already brings", introducing no new consistency model.

---

# 6. Export and portability

This is the *User-owned* principle made good. Portability comes in three tiers, from weakly dependent to strongly self-contained:

| Tier | Carrier | What you can use after taking it | Dependency |
|-|-|-|-|
| **Zero cost** | The raw file itself | Read/write directly in Finder / editor / git, fully usable away from the app | None—open format |
| **Saves re-embed** | space + `snapshot.parquet` + `snapshot.meta.json` | Reuse vectors when importing into another machine / another KB, don't re-burn tokens | embedder identity match |
| **Whole library** | The entire KB directory | Version-control as a git repo, migrate as a whole, relocate the root | None |

There are two **correctness gates** in the details of making this good:

- **On cross-embedder incompatibility, refuse to reuse rather than pollute**: `snapshot.meta.json` records the `{provider, model, dim}` at export time; on import it is compared against the current KB embedder—on mismatch it **does not load the cache + warns + re-embeds everything**, never mixing model A's vectors into model B's collection (that would produce silently wrong retrieval results). "Better to spend more tokens than to pollute the index."
- **On version drift, degrade safely**: vector reuse depends on "the text re-chunked matching what was exported". If the chunker version drifts → `text_hash` doesn't match → that batch falls back to a real embed (safe, just didn't save). Old snapshots whose `SNAPSHOT_VERSION` doesn't match are simply ignored, falling back to a full re-embed, without erroring ([architecture §5.7](architecture.md#57-snapshot-a-portable-embedding-cache)).

**No proprietary lock-in** is the overarching goal of all this: delete StashBase.app and the KB is still an ordinary directory usable by Finder / git / any editor / any MCP client. Export is **not a feature**, but the natural consequence of "the data was already in the user's hands".

> Boundary: V1 does not export to third-party tools' proprietary formats (Obsidian vault, Notion export, etc.). The judgment is that open formats (HTML/MD/PDF) are already the greatest common denominator; building further converters is an adaptation burden with low payoff; if truly needed, leave it to user scripts or the agent.

---

# 7. Lifecycle, deletion, and recovery

## 7.1 The life of a piece of data

```text
enter (stash/import) → index (chunk+embed) → maintain (agent generates summaries/backlinks/organizes)
      → rename/move (rename fast-path, reuses vectors) → delete (cascade cleanup)
```

Each step corresponds to a concrete mechanism in architecture; what the data layer cares about is **whether each step's side effects are symmetrically reversible**.

## 7.2 The deletion cascade

Deletion is not deleting a single file but deleting a group of associated artifacts—an asymmetric cascade is a breeding ground for bugs:

- **Delete a note** → also deletes the `<stem>_files/` resource bundle + removes all its chunks from the store.
- **Delete a PDF** → also deletes the derived `.paper.md` + `.paper_files/` + the hidden batch resume cache + the derived file's chunks in the store + the relevant conversion row; if extraction is still running, deletion cancels the child process.
- **Delete a space** → `deleteSpaceState` (`server/state-db.ts:235`) clears that space's `conversions` rows (the orphan-state trap in [§3.3](#33-the-partial-failure-state-machine)).

The DELETE API is **idempotent** (2026-06): if the target is already off disk → it returns `alreadyGone:true` rather than 404; the index cascade cleanup runs asynchronously after the HTTP response (`routes/files.ts:289`)—the disk visibility of the deletion precedes index consistency.

V1 is **hard delete**: no recycle bin, no version history. Reversibility is provided by **external git** (the KB is a repo, a deletion can be `git revert`ed), not built into the app. This is an explicit trade-off—hand version control to mature git rather than build a half-baked history layer.

## 7.3 Orphan data: tolerate rather than hunt down

Several kinds of orphans are **deliberately tolerated**, because hunting them down costs more than leaving them harmlessly in place:

- **The old `store/` after a root change**: the index is per-kbRoot; after a relocation the old root's store becomes an orphan, harmless if left in place (the new root rebuilds it automatically on boot) ([architecture §2.4](architecture.md#24-changing-the-kb-root-directory--optional-migration)).
- **Half-renamed chunks**: the rename fast-path aborts on any step's exception and falls back to the delete+re-insert slow path, **never leaving a half-renamed state**—this is one of the few "not tolerated" orphans, because it would produce wrong backlinks.
- **Old-version snapshots**: schema mismatch is simply ignored, neither cleaned up nor errored.

## 7.4 Recovery model: rebuildable derived data = the strongest disaster recovery

The whole recovery strategy is one sentence—**as long as the raw content / rules are still there, everything can be rebuilt**:

| Corruption/loss | Consequence | Recovery |
|-|-|-|
| Delete `state.db` | "Forgot what was indexed" | Re-hash all files on the next space open (a hash hit only updates the tuple, doesn't re-embed) |
| Delete / corrupt `store/` | Retrieval fails | Re-run ingestion; with a snapshot, reuse vectors and only fill in the misses |
| Delete the entire `.stashbase/` | Index + app-derived state all lost | The sum of the two above; raw content / rules untouched |
| Lose a raw file | **Really lost** | Only the user's git / backup can help—this is the one category that cannot be rebuilt |

So the **backup recommendation** converges to: put the KB under git (or any file backup), and `.gitignore` `.stashbase/`. Backing up raw content / rules is enough; the derived layer isn't worth backing up.

---

# 8. Concurrency and liveness

The previous sections covered "where the data lives, how it stays consistent"; this section covers **the actual concurrency structure**—process topology, runtime copies, wait relationships, timing windows, and the invariants that must hold when the system is healthy. The writing discipline of this section: only write what the code actually does right now, with each claim attached to a `file:line`; behavior that exists but whose soundness is uncertain is marked `⚠️` as a review to-do. The material comes mainly from the 2026-06-11 multi-daemon lock-contention incident ([§8.7](#87-incident-archive-2026-06-11-multi-daemon-lock-contention)).

## 8.1 Process topology and shared resources

Processes that may coexist on the same machine (after the 2026-06-12 singleton-ization):

```text
Electron main ─ spawn ─> Node server (:8090) ─ spawn ─> daemon (the only one, holds the Milvus LOCK)
external AI client (one per session) ─> MCP host (mcp/server.ts, stdio) ── HTTP ──> :8090
                                      └─(when no server exists, spawn a headless server, still the same :8090)
```

The MCP host **never opens the store**—it either connects to an existing server or spins up a headless server and then connects (`mcp/server.ts:ensureWeb`). The daemon's holder is therefore unique by construction: the `:8090` port binding is the singleton arbiter; the loser of a concurrent spin-up exits with `EADDRINUSE`, and the host connects to the winner. **The daemon is only spawned after winning `:8090`** (`bootBindAllSpaces` runs from the `listen` success callback, not before `listen`)—the loser never starts a daemon at all, closing the startup race window of "two servers each spawn a daemon before listening, the loser exits leaving an orphan".

| Shared resource | Ownership rule | Who enforces it |
|-|-|-|
| Milvus Lite (`store.nosync/milvus.db/` contains `LOCK`) | Single-process exclusive; the loser's behavior is undefined—measured: reads of old data work, **writes silently lost** | **Construction guarantee**: the daemon holder has only one slot, the server (the MCP host never opens the store, see above). Residual defenses: ① after winning `:8090`, **before** spawning its own daemon, `reapOrphanDaemons` SIGKILLs this library's orphan daemons matched by `--kb-root` command line (`server/stale-lock.ts`)—this one specifically treats **non-lock-holding** orphans (a lock-contention loser never got `milvus.db`, so `clearStaleMilvusLock`'s lsof can't see it, but if present it sends writes into a black hole) ② the daemon self-manages a sidecar flock (`store.nosync/daemon.lock`, exit 1 if it can't grab it)—prevents a **deliberate/accidental** second instance (e.g. `pnpm start --port 9000` hitting the same library); until the packaged binary is rebuilt this only takes effect in dev ③ before the server's first GUI bind, `clearStaleMilvusLock` clears the crash orphan still **holding** the `milvus.db` flock ④ the I2 assertion alarms after the fact (downgraded to a paranoid check) |
| Milvus WAL `.arrow` files (within the iCloud sync window) | iCloud evicting/rolling back a WAL being written → the file disappears out from under the running daemon's FD → every upsert/delete `FileNotFoundError`, the collection is corrupted | The store directory uses a **`.nosync` suffix** (`store.nosync/`)—macOS iCloud skips directories whose name ends in `.nosync`, keeping this purely per-machine derived data out of sync. `<KB>` is often under `~/Documents` (synced), so this is necessary, not optional |
| `:8090` port | Single web server | OS + `EADDRINUSE → process.exit(1)` (`server/index.ts:273`)—forced |
| `state.db` | Multi-process read/write | SQLite WAL (`server/state-db.ts:51`), needs no application-layer coordination |
| `~/.stashbase/config.json` | Multi-process read/write | ⚠️ unprotected: whole-file overwrite write, concurrent writes lose updates (low frequency, low impact) |
| Files under kbRoot | Multiple writers (GUI, agent shell, external editor, converter) | No locks, relies on reconcile to converge eventually (§3) |

**MCP single path** (`mcp/server.ts:viaWeb` / `ensureWeb`, since 2026-06-12, replacing the old `tryWebElseEmbedded` dual path): all tools go over HTTP; if no server → `spawnHeadlessServer` (detached, `STASHBASE_HEADLESS=1`, log `~/.stashbase/headless-server.log`) → poll for readiness (30s cap, single-flight dedup of concurrent cold starts) → send the request. On a mid-stream disconnect (fetch TypeError) re-spin once and retry; HTTP status-code errors are re-thrown as-is. The embedded indexer / `closeEmbedded` / fallback decision are all removed—"a second daemon" is no longer a reachable state.

## 8.2 Runtime copies and the invalidation protocol

§2 governs the ownership of on-disk data; here we have **the derived copies in process memory**—every row asks the same question: after the authority and the copy fork, who repairs it, and on what signal?

| Data | Authority | In-memory copy | Invalidation/repair signal |
|-|-|-|-|
| "Which files are indexed" | Milvus rows (the daemon's `status` computes on the fly, no cache) | ① `MfsIndexer.spaceIndex`/`spaceReady` (`server/indexer.mfs.ts:91-96`) ② UI `pendingNames` (`web-src/src/store/AppContext.tsx:565`, greys out the file tree + after hiding via `stashingPaths` (`store/state.ts`) merges into `getInFlightConversions` to feed the sidebar's "N stashing" pill and tab marker—**stashing = converting ∪ pending-index**, so a markdown folder drag-in is also counted) | ① daemon `generation` generation comparison, re-prime after respawn (`indexer.mfs.ts:155`) ② 1.5s polling |
| space ↔ window binding | `currentSpaces` Map (`server/space.ts:86`, windowId injected via AsyncLocalStorage, `space.ts:84-90` + `server/http.ts:51`) | Frontend app state | **In-process memory state, cleared on server restart**; after the frontend hits 412 NO_SPACE it re-opens |
| The daemon's space binding | the daemon process's in-memory `_bindings` | `MfsDaemon.bindings` (`server/mfs-daemon.ts:93`) | Direction reversed: Node is the replay source, the respawn's `ready` event triggers a full replay (fire-and-forget, a single failure only warns) |
| File-tree version | The disk directory's reality | `fsChangeCounter` → `/api/index-status`'s `treeVersion` (UI 1.5s polling) | All incremented explicitly (`noteTreeChanged`): write/delete/move routes call it after the disk operation, reconcile calls it after finding an actual change (`routes/indexing.ts` POST /api/sync)—there is no fs event source |
| Whether web is alive (MCP side) | Actual probe | `webLiveCache` 5s TTL (`mcp/server.ts`) | On TTL expiry or request failure, `invalidateWebLive`; after `ensureWeb` spins one up successfully it sets true directly |
| Index rules (excluded dirs/size cap/extensions) | **Node single source** (`server/indexable.ts` + `format.ts:NOTE_EXTS`), pushed down via the `set_rules` op after each daemon spawn's `ready` (`mfs-daemon.ts`) | daemon-side `_RULES` (the built-in constant is only a fallback for old Node) | Push-down failure (old binary doesn't know the op) → a loud warn to rebuild the binary. Drift symptom = one file is considered indexable on one side and not the other → permanent pending (daemon more lenient) or a delete-rebuild oscillation (Node more lenient) |

## 8.3 Lifecycle state machines

**The daemon process** (`server/mfs-daemon.ts`):

```text
(null) ─ensureReady─> spawning ─"ready"─> serving ──┐
   ▲                     │ 90s no ready → SIGKILL    │ op 10min no reply
   │                     ▼                           ▼
   └──── exit handler <─ dead <── close() (EOF→SIGTERM 1.5s→SIGKILL 3s)
          (readyP=null, all pending reject, generation kept incrementing)
```

- Each spawn does `generation+1`; generation-based caches invalidate by this (§8.2 first row).
- **Review red line: the state machine must not contain a state with no outgoing edge.** The two former no-outgoing-edge dead states—"spawning but never ready" (stuck grabbing the flock), "serving but op never replies" (stuck in the C extension, SIGTERM can't kill it)—were given outgoing edges after 2026-06-11 by `READY_TIMEOUT_MS = 90s` (`mfs-daemon.ts:65`) and `CALL_TIMEOUT_MS = 10min` (`mfs-daemon.ts:59`) respectively (timeout → `close()` → next call respawns + replays bindings).
- The daemon processes ops **serially** ⇒ the timeout tier must be globally uniform and lenient: `status` legitimately queues behind a long embed, and a tight per-op timeout would misfire when the daemon is busiest.

**space open/switch/close** (per window): `setCurrentSpace` (`space.ts:512`) → `onSwitch` → `scheduleIndexerSync` (`state.ts`) enqueues into that window's serial queue (bind → snapshot import? → `syncIndex`). `seq` short-circuits the stale tail of an expired switch; on close the queue entry is deleted. (The fs.watch re-mount branch was removed along with the watcher layer.)

**KB root switch**: `setKbRoot`'s change listeners (per-space MCP restart, watcher re-mount, etc.) are, since 2026-06, fired one by one fire-and-forget (`space.ts:272`, formerly an awaited `Promise.all`)—switching the root is no longer blocked by a slow/bad listener, at the cost that when the root switch returns the listener side effects may not be complete ⚠️ (an immediately following operation may briefly see the old MCP state).
⚠️ The queue is chained with `prev.catch().then()`—one never-settling link blocks all subsequent open/switch on that window (queue poisoning). After the daemon timeout lands, every link is bound to settle, theoretically closing the loop, but "a queue entry must settle in finite time" has no independent guarantee (see §8.6-I4).

**Conversion pipeline**: see §3.3. Derived `.md` entering the index goes through **direct push on conversion completion** (`conversion.ts:setDerivedNoteIndexer`, injected at boot)—no intermediate layer; the old indirect dependency of "write to disk → watcher picks it up → enter the index" has been removed. PDF rich extraction has a batch-level outgoing edge: each `pymupdf4llm` batch runs in an isolated child process with a 180s default timeout, then falls back to plain PyMuPDF text for that batch. Completed PDF batches are checkpointed to a hidden resume cache, but the final `.pdf.md` remains the only "done" fact.

## 8.4 The wait graph

Who awaits whom. **Deadlock review = find cycles and unbounded edges in this graph.**

```text
HTTP routes (incl. focus / turn-end / manually triggered /api/sync)──┐
MCP host ── HTTP ────────────────────────────────────────────────────┼─> indexer.* ─> MfsDaemon.call ──[10min]──> daemon stdio
space open/switch serial queue ── bind/import/syncIndex ──────────────┘
```

| Wait edge | Type | Fallback |
|-|-|-|
| `call → daemon reply` | Once unbounded | `CALL_TIMEOUT_MS` 10min → reject + restart the daemon |
| `ensureReady → "ready"` | Once unbounded | `READY_TIMEOUT_MS` 90s SIGKILL |
| `indexerSwitchQueues` chain | Serial queue, can be poisoned | Each link's daemon timeout indirectly guarantees it + **the watchdog independently supervises** (an entry not settled in 15min warns, with space/reason/window, `state.ts:ensureSwitchWatchdog`)—it only supervises, doesn't intervene: the first index of a big space legitimately runs for tens of minutes, and a hard timeout would misfire |
| `primeInflight` (`indexer.mfs.ts:101`) | Single-flight dedup | Goes through `call`, covered by the 10min |

A historical lesson: **any unhedged edge on this graph has the identical failure presentation**—a function silently disappears, zero logs. When adding an await you must answer "by what latest time does it settle".

## 8.5 The timing-window table

Each window = a class of potential problem of "events lost / misjudged within the window".

| Window | Value | Purpose | Boundary risk |
|-|-|-|-|
| focus-sync throttle | 5s (`AppContext.tsx`) | A fast focus/blur loop doesn't stack syncs | External changes within the throttle window wait for the next event point (agent turn-end / manual Sync both make it up) |
| webIsLive cache | 5s (`mcp/server.ts`) | Avoid a 300ms probe every time | Within the 5s after a server just died it still sends a request → TypeError → re-spin the server and retry once, self-heals |
| headless server startup wait | 300ms polling × 30s cap (`mcp/server.ts:ensureWeb`) | A tool call during cold start waits for the server to be ready | On timeout, error pointing to `~/.stashbase/headless-server.log`; concurrent calls single-flight share one wait |
| `noTextCache` | (size,mtime) key (`indexable.ts:86`) | Avoid re-parsing large HTML on every 1.5s poll | A change within mtime granularity reads the old value, the dual key is enough in practice |
| import-conversion optimism window | 6s (`importStashingGrace`, `AppContext.tsx`) | After dragging in a PDF/image, light up "stashing" before the server registers the conversion | If after 6s the server still hasn't taken over that path → expire and clear, avoiding a never-converting file being stuck |
| import-index optimism window | 60s (`importIndexGrace`, `AppContext.tsx`) | After dragging in md/html, light up "stashing" immediately by the real count—the daemon queues `status` behind the embed it's already running, so a bare poll under-counts and lags (4 mds read as "3 stashing"). **Not handed off per path** (mid-embed `pending` is unreliable); the whole-batch completion signal to clear is the space's `upToDate` | If there was already a stuck pending before import, `upToDate` won't flip → rely on the 60s cap to clear |

## 8.6 The invariant list

Propositions that hold permanently when the system is healthy, **each annotated with "who guarantees it"; ⚠️ = only a convention, no code guarantee**—this list is also ready-made input for future runtime assertions (health checks).

- **I1 Index convergence**: a file hits disk and is indexable ⇒ at the next event point (the write path indexes directly; external writes get collected at focus / turn-end / open / manual Sync) it enters the daemon `status`'s indexed set. Guarantee: the trigger is a definite event, not an fs event stream + all of §8.4's timeouts as fallback. The convergence point shifts from "after the 800ms debounce" to "the next event point"—later but **enumerable**.
- **I2 Sync doesn't lie**: `syncIndex` returns `added=[X] ∧ failed=[]` ⇒ in the immediately following `status`, X ∉ pending. Guarantee: `sync.ts:assertSyncConverged` does one status re-check after every non-empty sync, and on violation logs ERROR (with the "check for a second daemon" troubleshooting guidance); files that legitimately produce no chunks (oversized / no extractable text) are filtered out so they don't false-alarm. Detection doesn't prevent—a black hole can still happen, but no longer silently.
- **I3 Single daemon**: at most one daemon per kbRoot holds the Milvus LOCK, and only the lock-holder receives writes. **Construction-enforced** (since 2026-06-12): the daemon holder can only be the `:8090` server, and the MCP host never opens the store—on the normal path a second instance is unreachable; the daemon-side flock blocks a deliberate/accidental out-of-bounds instance, and the I2 assertion shouts out the consequence of anything that slips through.
- **I4 The queue must settle**: every entry of `indexerSwitchQueues` settles in finite time, and every same-space `syncSpaceNow` call is serialized through `spaceSyncQueues` before it reaches delete→upsert work. Indirectly guaranteed by "every link has a timeout" + the watchdog's independent supervision (warns if not settled in 15min). (The old watcher barrier `awaitIndexerReady` was removed along with the watcher layer—bind→import→sync are all serial within the queue, with no external waiter.)
- **I5 Context independence**: `sync.ts` and the conversion layer (discovery / maybeConvert, aligned 2026-06) read no ambient window context anywhere in the flow—the space is passed explicitly, and kbRel is always derived from the absolute path against kbRoot (`sync.ts:49,56`, `conversion.ts:kbRelOf`). The only exception is the UI view (`getInFlightConversions` filtering by the current window's space—that's per-window display semantics by nature). Review red line: **code that explicitly has X yet looks X up again via the ambient channel is all this class of bug** (the old `indexOne` did exactly this, causing headless `reindex` to wipe out entirely).
- **I6 Generation consistency**: after a daemon respawn, all generation-based caches re-prime before next use. Guarantee: `ensurePrimed` compares `currentGeneration` (`indexer.mfs.ts:155`).
- **I7 Rules single source**: there is only one copy of the index-admission rules—Node defines them, `set_rules` pushes them down, the daemon executes them in walk/status/scan_diff; the Node side no longer does a second pending filter (removed 2026-06, the sole exception being the content-semantic `hasNoExtractableText`—deliberately kept in Node per the boundary "the daemon doesn't touch format logic", `routes/indexing.ts`).

## 8.7 Incident archive: 2026-06-11 multi-daemon lock contention

One incident strings together most of this section, kept as review material:

1. MCP host had no windowId → web path 412 → (old version) indiscriminate fallback to embedded → **a second daemon** (violating I3). (After 2026-06-12 this path doesn't exist at all: embedded mode removed, the MCP host changed to spin up/reuse the sole server—this class of incident is eliminated by construction; this item is kept as history.)
2. The GUI daemon was half-open in the lock contention: reads fine, **writes a black hole**—upsert returns ok+chunks, the store has no rows (violating I2, zero alarm).
3. During that period a bind call never replied (at the time `call` had no timeout) → the queue entry never settled (violating I4) → the aggregate barrier closed forever → all watcher syncs silently queued up (violating I1). The only presentation was "new files in the sidebar blinking forever". (The watcher/barrier layer involved was removed wholesale in 2026-06; this item is kept as history.)
4. The old `indexOne` translated the path using ambient context (violating I5) → headless `reindex` errored per file, compounding the difficulty of diagnosis.
5. A red herring: dev had once silently run a stale PyInstaller daemon (fixed: dev skips the `PROJECT_ROOT` candidate, `server/mfs-daemon.ts:resolveDaemonBinary`).

The lesson distilled: **liveness failures present highly homogeneously (a function silently disappears); localization relies on the "fingerprint" of which invariant was violated**—which is precisely why §8.6 should become runtime assertions.

---

# 9. Open questions

Data-layer problems V1 consciously left to be tightened in V2+, collected here so they don't scatter:

1. ~~**Duality of the per-file index truth**~~ **converged**: the `state.db.files` table is removed, the daemon's `scan_diff` (store reality) is the sole authority (§3.3). The residual form is the fork risk of in-process runtime caches, covered by §8.6's I2/I6.
2. **The risk window from the missing cross-store transaction**: there is no atomic commit between Milvus and state.db, hedged by "reconcile converges eventually + conservative write order". Acceptable under low write frequency; needs re-review when write frequency rises (e.g. bulk agent maintenance).
3. **Cross-file content dedup**: the data layer only dedups identical chunk text, doesn't recognize "the same paper imported twice". Currently left to agent maintenance; whether the data layer should provide a "near-duplicate detection" primitive is to be discussed.
4. **Soft delete / version history**: V1 hard-deletes and relies on external git. Whether to build in a recycle bin/snapshots depends on whether the target users all use git.
5. **The sync unit and conflict model of cloud sync** ([§5.3](#53-cloud-sync-roadmap-not-implemented)): raw files + snapshot vs the whole store; keep-both vs merge; E2E or not. Leaning toward "productizing the sync path the user already brings", but undecided.
6. **Multiple machines sharing the same `store/`**: V1 explicitly forbids it (Milvus Lite single writer). If V2 wants real-time multi-machine, it needs to switch to a multi-machine-capable vector backend or introduce a sync layer—this is the heaviest piece.
7. **The data destiny of unindexable content**: images only enter the index via their OCR text layer (pure pictorial meaning is not retrievable); video hits disk and doesn't enter the index at all (screen recording is already note-first: the original video is stored as a note attachment under `recording-<ts>_files/`, with a link at the end of the note that opens an external browser for playback; the note-first handling of dragged-in video is uniformly scheduled for V2, and Vision-first text reconstruction is on the roadmap). In the data layer they are first-class citizens that are "content present, derived absent"; until text reconstruction lands, their value to the memory layer is limited ([architecture §4.7](architecture.md#48-screen-recording-capture-and-clipboard)).

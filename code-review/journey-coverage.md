# Journey Coverage

This is the canonical traceability and evidence map for StashBase's stable
product journeys. A journey defines the observable product promise; this file
records which engineering contracts protect it and what evidence currently
supports or contradicts it. Tests and Evals own exact fixtures, inputs, and
assertions.

This is not a source-file inventory. For reverse review, trace changed code to
its nearest owning contract, then use this map to find affected journeys.
Cross-cutting infrastructure may stop at a contract when it has no direct user
outcome, but user-visible behavior without a journey is a traceability gap.

## Product Baseline

StashBase is an IDE for writing. The primary journey enters a project,
brainstorms, writes, and refines. Project entry, discussion, drafting, revision,
and the supporting file/context capabilities are implemented. The remaining
product feature is document-specific diff for fine revision.

Coverage status below describes evidence, not feature completeness. Existing
file/line-diff or save-conflict tests do not prove the unfinished document-diff
experience. J01 and J10 now include an empty-project discussion path; older
source-first evidence is retained with its actual limits, not promoted to a
pass for the revised journey. J11 is a retained secondary boundary whose
in-app entry is unavailable, not the main activation flow.

## Evidence Model

- **Contract Test** proves a deterministic Interface, invariant, failure mode,
  or recovery rule at the lowest useful layer.
- **Driven Runtime Pass** proves that the decisive observable flow crosses its
  real product Seams by driving the built application. Journey automation
  retired with the Playwright suites, so this evidence is currently produced by
  hand and recorded in the owning task entry rather than replayed by a
  command.
- **AI Eval** measures probabilistic quality such as semantic relevance,
  source grounding, context use, or task completion on representative inputs.
- **Release Check** covers behavior that requires a packaged application,
  native dependency, real provider, credential, operating-system integration,
  or third-party client.

Coverage status is independent of evidence type:

- **Covered** — decisive evidence exists for every Required Observable Result
  at the appropriate layer.
- **Partial** — important lower-level evidence exists, but at least one
  Required Observable Result lacks decisive evidence.
- **Release-dependent** — automation is complete as far as the repository can
  prove, but a named packaged or external check remains.
- **Gap** — a Required result is contradicted by Shipping behavior or lacks
  meaningful evidence.

Broad commands are validation entry points, not proof by themselves. A passing
suite supports only the named behavior its tests exercise.

When a Journey crosses format capability, evidence is selected by behavior
class rather than by extension count: editable prose, editable structured
text, direct preview-only text, binary preview with prepared text, OCR image,
and transcript media. The
[Documents matrix](../design-docs/design/documents.md#format-capability-matrix)
owns the Shipping capability claim; shared format-detection tests own extension
aliases, and a driven runtime pass owns representative composition.

## Traceability Map

| Journey | Product areas | Primary review contracts |
|---|---|---|
| [J01 Onboarding](../design-docs/user-journeys.md#j01-complete-onboarding-and-reach-first-value) | [Workspace](../design-docs/design/workspace.md), [Search](../design-docs/design/search.md), [Agent Panel](../design-docs/design/agent-panel.md) | [Renderer Workspace](renderer-workspace.md), [Settings and Config](settings-config.md), [Agent Panel](agent-panel.md), [Window Lifecycle](window-lifecycle.md) |
| [J02 Folder](../design-docs/user-journeys.md#j02-add-and-open-a-folder) | [Workspace](../design-docs/design/workspace.md) | [Renderer Workspace](renderer-workspace.md), [File Transactions](file-transactions.md), [Data Lifecycle](data-lifecycle.md), [Window Lifecycle](window-lifecycle.md) |
| [J03 Documents](../design-docs/user-journeys.md#j03-read-and-edit-source-documents) | [Documents](../design-docs/design/documents.md), [Workspace](../design-docs/design/workspace.md) | [Markdown Rendering](markdown-rendering.md), [Document Viewers](document-viewers.md), [File Transactions](file-transactions.md), [Renderer Workspace](renderer-workspace.md), [Window Lifecycle](window-lifecycle.md) |
| [J04 Preparation](../design-docs/user-journeys.md#j04-prepare-a-hard-to-read-file) | [Preparation](../design-docs/design/preparation.md) | [Data Lifecycle](data-lifecycle.md), [Document Viewers](document-viewers.md), [File Transactions](file-transactions.md), [Settings and Config](settings-config.md) |
| [J05 Search](../design-docs/user-journeys.md#j05-search-and-open-source-evidence) | [Search](../design-docs/design/search.md), [Workspace](../design-docs/design/workspace.md) | [Data Lifecycle](data-lifecycle.md), [Renderer Workspace](renderer-workspace.md), [Settings and Config](settings-config.md), [MCP Access](mcp-access.md) |
| [J06 Agent](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat) | [Agent Panel](../design-docs/design/agent-panel.md) | [Agent Panel](agent-panel.md), [Agent Runtime](agent-runtime.md), [MCP Access](mcp-access.md), [Settings and Config](settings-config.md) |
| [J07 Converge](../design-docs/user-journeys.md#j07-converge-chat-into-a-document) | [Agent Panel](../design-docs/design/agent-panel.md), [Documents](../design-docs/design/documents.md) | [Agent Panel](agent-panel.md), [MCP Access](mcp-access.md), [File Transactions](file-transactions.md), [Markdown Rendering](markdown-rendering.md) |
| [J08 External MCP](../design-docs/user-journeys.md#j08-connect-an-external-agent-through-mcp) | [Search](../design-docs/design/search.md), [Workspace](../design-docs/design/workspace.md) | [MCP Access](mcp-access.md), [File Transactions](file-transactions.md), [Data Lifecycle](data-lifecycle.md), [Settings and Config](settings-config.md) |
| [J09 Bug report](../design-docs/user-journeys.md#j09-prepare-and-hand-off-a-bug-report) | [Bug Reporting](../design-docs/design/bug-reporting.md) | [Bug Reporting](bug-reporting.md), [Window Lifecycle](window-lifecycle.md), [Architecture](architecture.md) |
| [J10 Core loop](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work) | [Workspace](../design-docs/design/workspace.md), [Documents](../design-docs/design/documents.md), [Preparation](../design-docs/design/preparation.md), [Search](../design-docs/design/search.md), [Agent Panel](../design-docs/design/agent-panel.md) | [Renderer Workspace](renderer-workspace.md), [Data Lifecycle](data-lifecycle.md), [Agent Runtime](agent-runtime.md), [Agent Panel](agent-panel.md), [MCP Access](mcp-access.md), [File Transactions](file-transactions.md), [Markdown Rendering](markdown-rendering.md) |
| [J11 Conversation to project](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project) | [Workspace](../design-docs/design/workspace.md), [Agent Panel](../design-docs/design/agent-panel.md) | [Renderer Workspace](renderer-workspace.md), [Settings and Config](settings-config.md), [MCP Access](mcp-access.md), [Agent Runtime](agent-runtime.md), [Agent Panel](agent-panel.md), [File Transactions](file-transactions.md), [Data Lifecycle](data-lifecycle.md) |
| [J12 Build Wiki Pages](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder) | [Agent Panel](../design-docs/design/agent-panel.md), [Search](../design-docs/design/search.md), [Workspace](../design-docs/design/workspace.md) | [Agent Panel](agent-panel.md), [Settings and Config](settings-config.md), [Renderer Workspace](renderer-workspace.md), [File Transactions](file-transactions.md), [Data Lifecycle](data-lifecycle.md) |
| [J13 Gallery download](../design-docs/user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery) | [Agent Panel](../design-docs/design/agent-panel.md), [Workspace](../design-docs/design/workspace.md) | [Gallery](gallery.md), [Agent Panel](agent-panel.md) |

## J01: Onboarding

**Status:** Release-dependent.

- **Contract Test:** renderer initialization, Settings state, workspace
  navigation, and Electron lifecycle are exercised by `pnpm test:renderer`,
  `pnpm test:config`, `pnpm test:updates`, and `pnpm test:electron:smoke`.
  Startup tests in `electron/main-probe.test.cjs` exercise the port-arbitration
  and readiness path, including rejection of a prior instance's health,
  bounded probing before child-side orphan recovery, and failed child startup.
  `electron/multi-window.test.cjs` executes the native activation registration
  with a delayed window factory to prove it shares initial startup, ignores
  activation with live windows, and reopens after the last window closes.
  Appearance route tests exercise the actual config writer and reject arrays
  and unknown fields without changing persisted preferences. Native lifecycle
  tests cover save-refusal cancellation of explicit quit intent.
  `server/folder-startup.test.ts` in `pnpm test:project-files` exercises
  unavailable-member retention through startup and both registration paths,
  true home emptiness, failed-copy retry, config-reset recovery without
  overwriting edits, and deletion without reseeding. The project route suite
  separately proves deliberate registry removal stays removed across restart.
  Orphan identity checks remain covered by `server/stale-lock.test.ts`.
  `electron/workspace/session.test.cjs` drives multiple authorized IPC senders
  against real session files, including blank-window writes, stale folder
  records, pruning, retry after failure, and persistence bounds. The Electron
  boundary smoke loads two built renderers, toggles the second window's Welcome
  sidebar, and verifies the first window's saved tabs survive on disk while
  their live snapshots remain separate. This uses a local HTTP fixture and
  does not prove a complete folder reopen against the production server.
  The real Electron request-authorization smoke in `pnpm test:electron:smoke`
  exercises registered-window HTTP/Agent identity, denial of alternate path
  spellings and unregistered windows, read-only document resources, and the
  explicit Vite origin's static/HMR requests. The
  real socket upgrade test in `pnpm test:conversion-scheduler` separately proves
  canonical Agent and explicit Vite routing. These are boundary evidence, not
  an end-to-end Agent turn.
  The renderer Settings suites cover the bring-your-own key for search by
  meaning, the only source the product offers. Server config suites cover
  rejection of retired local and hosted-account selections, deterministic
  migration of either persisted value before daemon startup, and transactional
  BYOK source activation that keeps the prior source selected when runtime
  reset or binding fails.
  Account identity fixtures cover profile normalization, migration, privacy,
  and UI fallbacks.
  Renderer state evidence keeps bootstrap settlement distinct from confirmed
  project registration, so a failed or pending membership load cannot claim the
  project registry is empty.
  Search by meaning being opt-in is proven at three layers: a domain test
  that only the reader's own key counts as on; a composition test that every
  folder reads as not set up until that key is on, whatever the daemon
  reports; and a surface test that the search panel is keyword search alone,
  with no tab strip and no explanation, while it is not set up or unknown.
  The account row is proven through the shell: a signed-out sidebar starts
  the browser sign-in in one click and holds one pending state through the
  round trip, and a signed-in one names the person and opens a menu that
  shows their initial where no picture arrived, their email, the credits, and
  sign-out. The Agents panel suite
  proves a runtime that needs an account starts that same sign-in rather than
  sending the reader elsewhere.
  The update surface is proven at three layers: a wire contract that refuses a
  snapshot carrying a field its phase does not allow; an Electron boundary
  suite covering an authorized call, a foreign sender, a window without the
  capability, a state the projection cannot describe, and the
  development-only simulator having no handler in a packaged build; and
  renderer suites over the phase table, the adapter's validation, both view
  models, and the notice by role and label, including installation from Settings
  after dismissing the announcement. The boundary smoke asserts the preload's
  frozen updates key list and exercises two built renderers through saving,
  native input locking, delayed MacUpdater handoff, and failure rollback with
  a controlled native installer.
- **Driven Runtime Pass (updates):** a built-renderer pass with controlled
  updater state dismisses both available and ready announcements, opens
  Settings General, and invokes Update and restart / Install and restart
  through the real preload. The controls remain visible and fit the Settings
  row. Native package replacement is not part of this pass.
- **Driven Runtime Pass:** the orient step is driven through the real
  application against a scratch profile whose project registry is seeded with several
  members, one of them under the system's temporary directory. A bare window
  shows the welcome with the ways-in card beside the recent list, the list
  names the members newest first without the temporary one, a row's menu
  opens on hover, and a pane too narrow for both columns stacks the card
  above the list. The return step is driven the same way: a relaunch whose
  session file names a folder and recorded its sidebar open lands on the
  welcome screen with the sidebar collapsed and that folder's session intact,
  and opening it from Recent brings its tree back with the column. On macOS
  the same pass checks the sidebar's toggle, open and collapsed, sits clear
  of the traffic lights, and return to the edge in native fullscreen. The
  same scratch-profile pass checks the account row: a signed-out sidebar's
  foot reads Gallery, Settings, and **Sign in**, and Settings opens on an
  Agents section whose first group is the account with its own **Sign in**,
  ahead of the runtimes; the signed-in row and its menu are proven by the
  shell test rather than driven, because the hosted service cannot be reached
  with a seeded session. The later steps of this journey are not driven;
  journey automation retired with the Playwright suites.
  A separate macOS startup pass uses an isolated profile and the built renderer:
  cold launch opens Welcome, a second native window shares the same server
  instance, closing one window leaves its peer's service alive, and closing all
  windows before quit releases the port. A disposable orphan listener bearing
  this install's server entry withholds health responses; relaunch reclaims it
  and opens Welcome with a fresh instance. OS URL registration is stubbed and
  key protection is unavailable in this harness.
  A 2026-09-14 macOS pass delays server readiness and emits activation twice
  through the real main entrypoint: only one built Welcome window appears.
  The isolated profile receives the complete bundled introduction without
  selecting it; closing the window and activating again opens one replacement.
  This pass also stubs OS URL registration and disables key protection; it
  proves startup and reopening, not Gallery assets or packaged installation.
  A separate 2026-09-14 macOS pass uses the real main entrypoint, built renderer,
  and built server with an isolated profile: one explicit quit closes a loaded
  window through its save guard and reaches shutdown. A deliberately refusing
  preload handler keeps the window open and cancels quit intent; after removing
  that handler, ordinary close keeps macOS running and activation reopens it.
  The same pass rejects an appearance array and persists an accepted theme
  through authenticated HTTP. OS key protection is a stand-in in this pass.
- **AI Eval:** onboarding mechanics are deterministic. If first value uses
  semantic retrieval or a real Agent, its quality evidence comes from J05 or
  J10 rather than being duplicated here.
- **Release Check:** Gatekeeper acceptance of the Developer ID-signed and
  notarized macOS artifact, packaged first launch, native folder selection,
  offline startup, one first-session-to-returning-session pass, and real
  N→N+1 desktop updates on supported platforms remain release evidence.
- **Gap:** no single driven runtime pass currently proves that a first-time user sees
  the local-file/derived/hosted distinction, enters an empty project,
  completes a useful brainstorm, and returns without unnecessary onboarding
  replay. Existing startup and file-entry passes do not prove that sequence.
  The first local-model download and selection path is also lower-layer and
  packaged-release evidence rather than a complete driven runtime pass.
  Update interaction and native handoff are exercised with controlled updater
  state; real download, package replacement, and relaunch remain release
  evidence because normal unpackaged builds report `unsupported`.

## J02: Folder

**Status:** Partial and release-dependent.

- **Contract Test:** workspace transitions, project mutation, cleanup, GitHub
  repository import (`server/__tests__/github-import.test.ts`,
  `renderer/src/features/workspace/infrastructure/github-import-api.test.ts`,
  `renderer/src/features/workspace/hooks/use-github-import.test.ts`), and
  window retirement run through `pnpm test:renderer`,
  `pnpm test:project-files`, and `pnpm test:electron`. Picker, IPC, registry,
  and HTTP regressions preserve path whitespace; the real project registry route test
  opens/removes a POSIX folder distinct from its trimmed sibling.
  `server/project-removal.test.ts` exercises the real index daemon: removing a
  parent preserves a nested project's namespace, prepared text, and failure
  records, including cached preparation for a temporarily missing member.
  It also locks retirement across every registered Agent adapter and rejects
  overlapping removal or registration. Scheduler tests preserve retained
  descendants' active preparation and auxiliary work.
  GitHub import tests also exercise post-reservation collisions, rollback that
  preserves new files, edits and directory replacements, exclusive-copy fallback,
  cancellation during final publication, and real-child cancellation/timeout
  during Git detection.
  `server/project-open.test.ts` exercises slow-directory yielding, stale reads,
  superseded opens, close/retirement during an open, validation and persistence
  failure before commit, root labels, and retained member spelling. Native
  registry tests exercise real macOS case and Unicode identity, asynchronous
  matching, and preserved initial-folder spelling.
- **Driven Runtime Pass:** 2026-09-14, isolated macOS source application with
  the built renderer and real server: Welcome's Open action receives an
  existing directory through the real picker bridge (dialog selection stubbed),
  enters its file tree, and retains that selection after a missing-folder open
  is refused. A second window claims a case alias using the retained member
  spelling; repeating the request focuses that peer. Source bytes and directory
  contents remain unchanged. OS URL registration and key protection are
  stubbed; this pass does not prove Agent sessions or native picker interaction.
- **Driven Runtime Pass (creation):** 2026-09-14, isolated macOS application
  using the built renderer and server: Welcome's Create action traverses the
  real picker bridge, registers the returned new directory, and opens its empty
  workspace. The dialog's directory creation and selection are test substitutes;
  this does not prove interaction with the operating-system picker.
  The entry-consolidation pass also verifies first-launch introduction seeding,
  recreation of a deleted default home without reseeding, retirement of the
  legacy GET snapshot, and service creation under a space-suffixed parent.
  Duplicate creation returns a conflict, and an unattributed or stale caller
  registers its new project without changing the existing window binding.
- **Driven Runtime Pass (GitHub import):** 2026-09-14, isolated macOS application
  with the built renderer and server: Welcome's Import dialog clones the public
  `octocat/Hello-World` repository into a named folder and opens that project's
  window binding. The real Git clone has shallow history, the canonical origin,
  a clean worktree, and no remaining import staging directory. OS URL registration
  and key protection are stubbed; Git/network acquisition is real. This pass does
  not assert completion of background file listing or indexing.
- **AI Eval:** not required.
- **Release Check:** real operating-system folder picking, Git cloning of public
  repositories, and file drop remain release evidence.
- **Gap:** repository publication reserves the final directory without
  clobbering concurrent user state, but Node lacks a cross-platform atomic
  no-replace directory rename; see the File Transactions Known Gap.
  The separate trailing-space folder pass reached registration and binding but
  failed downstream scoped reads; see the File Transactions Known Gap on
  folder scope after entry.

## J03: Documents

**Status:** Release-dependent.

- **Contract Test:** renderer, viewer, Markdown, JSON, TXT, file transaction, and
  Electron lifecycle suites cover source identity, parsing, mode changes,
  ordinary saves, navigation, removal of native reload bypasses, save-gated
  recovery reload, shared renderer/Agent/MCP version authority, conflict
  decisions, format detection, content-write boundaries, and their
  failure/confirmation paths. `server/__tests__/file-listing.test.ts` locks
  default and show-hidden listings, protected VCS/derived paths, bounded
  hidden excluded rows, sync/async parity, and large-scan yielding;
  `pnpm test:config` locks default-off recovery, strict failure, and durable
  hidden-files persistence.
  Recovery journal tests serialize publication, listing, and discard, including
  queue recovery after a failed write; recovery routes preserve distinct folder
  and filename whitespace through write, list, read, and discard.
  `server/text-file-transaction.test.ts` covers concurrent versioned saves,
  external edits during staging, and link rewrites/rollback that preserve newer
  source content. `server/routes/file-assets.test.ts` covers asset disappearance,
  Range/hidden-resource transfer, and DOCX fallback freshness/completion.
  Native workspace-store tests retain the previous snapshot when replacement
  fails. On the renderer side
  `renderer/src/features/workspace/hooks/use-hidden-files.test.ts` locks the
  echoed state through rapid and failing writes,
  `renderer/src/features/workspace/ui/file-tree-menu.test.tsx` locks the
  toggle's checked semantics in the tree's own context menu, and
  `renderer/src/features/workspace/infrastructure/files-api.test.ts` locks row
  marking and stale continuation ownership.
  `renderer/src/features/documents/domain/tabs.test.ts`, `domain/history.test.ts`,
  and `application/tabs-runtime.test.ts` lock preview reuse, keep on the
  first edit, the kept-only session projection, and history stepping that
  prefers an open tab and never adds a kept one;
  `renderer/src/features/documents/ui/workspace/tabs.test.tsx` and
  `ui/workspace/history-buttons.test.tsx` lock the preview label, the
  double-click and Enter keep, and the arrows' named targets;
  `renderer/src/features/workspace/ui/file-tree-rows.test.tsx`,
  `file-tree.test.tsx`, `file-tree-naming.test.tsx`, `domain/tree.test.ts`,
  and `hooks/use-file-operations.test.tsx` lock the tree's browse and keep
  gestures and the draft create with its Untitled name, kept tab, and
  rename on the new row; `renderer/src/features/documents/hooks/use-new-tab.test.ts`
  and `ui/workspace/tabs.test.tsx` lock the New tab's life, opened from the
  strip's plus, seated last and selected, closed by a chosen document and
  not brought back by it; `renderer/src/app/composition/layout/workspace-sidebar.test.tsx`
  locks the band's arrows following the sidebar mode, Documents returning to
  the panel it left on, their handoff to the
  titlebar on collapse, and a draft started from the New tab's page end to end.
- **Driven Runtime Pass:** crash recovery is driven through the real
  application with a stand-in keyring, covering a crash, the relaunch, the
  offer of the surviving draft, the restore into a dirty editor, its autosave
  through the ordinary versioned save, and the journal clearing afterward.
  A 2026-09-14 isolated built-server/Electron pass writes and reads six distinct
  recovery identities across two member roots and three source names differing
  only by whitespace. It uses a stand-in OS keyring and real encrypted journal;
  this proves HTTP/storage identity, not the editor's recovery presentation.
  2026-09-13, built app launched in isolation (own user data, own port,
  scratch home, mock keychain) over a scratch member folder: a tree click
  opened a preview tab, the next click reused it, a double click kept a tab
  and the next click opened a preview beside it; Back named and reached the
  previous file twice, with the replaced preview coming back as the preview,
  and Forward returned; New draft opened an Untitled kept tab with the Files
  panel showing, the row's rename field focused, and the stem selected,
  and typing a name renamed the file on disk and retitled the tab; a relaunch
  on the same user data restored the kept tabs and not the preview. The rest
  of the journey has no driven pass: reading, editing, saving, navigating
  under the save barrier, and external-write conflict resolution are proven by
  the contract tests above and not yet by driving the built application.
- **Driven Runtime Pass (document API):** 2026-09-14, isolated macOS built
  application with its real Electron window and server: after native-picker
  project entry, two window-originated saves using one source version return
  one success and one `409 FILE_CHANGED`. The accepted response, subsequent
  read, and disk content agree; a missing folder-scoped asset returns `404`.
  Picker selection and OS key storage are substitutes. This pass drives the
  document API from the window, not editor typing or conflict-dialog decisions.
- **AI Eval:** not required.
- **Release Check:** complex packaged PDF, DOCX, and media behavior remains
  release evidence.
- **Gap:** none in the deterministic save/conflict path. The retired journey suite proved
  external-write recovery; separate save and mutation tests prove that renderer,
  Agent, and MCP writes share the same version authority. See
  [File Transactions](file-transactions.md#renderer-conflict-recovery).
  The Show Hidden Files toggle is covered by the server and renderer contract
  tests above plus the J03 navigation-depth Journey.

## J04: Preparation

**Status:** Release-dependent.

- **Contract Test:** `pnpm test:config`, `pnpm test:conversion-scheduler`, and
  `pnpm test:python` cover preparation preferences, scheduling,
  format completion, cancellation, PDF/OCR spawn configuration, freshness,
  checkpoints, and recovery. Media handoff tests cover original model/language
  retention, checkpoint reuse, automatic rediscovery, coalesced previews, user
  cancellation, and model unavailability. Native cancellation tests include a
  stubborn descendant whose parent exits; schema tests exercise source and bundled workers with small
  buffers. The transcription sidecar build validates AVI probe, inference
  decoding, and Opus fallback against its staged executables.
  `pnpm test:package-inputs` locks the static
  Windows extractor bootloader argument wiring without discarding stderr,
  component asset publication, and the embedded manifest. Component tests cover
  shared downloads, checksum and archive confinement, one attempt per launch,
  explicit retry, status-only reads, failure retention, independent
  cancellation, lane release, and offline reuse after a process restart.
- **Driven Runtime Pass:** Media API, 2026-09-14, isolated macOS built Electron
  application and server using the rebuilt native media tools and a copied,
  SHA-256-reverified tiny model. Window-originated requests reprocess a synthetic
  AVI with a Japanese override, prepare its playback fallback, read the final
  Japanese transcript, and retrieve a byte range from the WebM preview (`206`).
  The native picker and OS key storage are substitutes; inference is real.
  This proves backend composition, not player interaction or recognition quality
  on real speech.
- **Driven Runtime Pass:** PDF/OCR component recovery, 2026-09-15, isolated
  macOS built Electron application and server with packaged resource resolution.
  First demand receives HTTP 503; Settings → General shows the failure and
  Retry download, status polling makes no further download, and both sources
  remain yielded. Clicking Retry makes exactly one more attempt. A new app
  process then downloads the component once, resumes native PDF/OCR, returns
  both sources in keyword search, and shows Installed in Settings. A third
  process restarts offline and reprocesses both fixtures with zero component
  requests, preserving searchable text and Installed status.
  The payload is from a retained macOS build; transport, native picker, and
  OS key storage are substitutes. This proves runtime composition, not fresh
  Developer ID notarization or live GitHub/CDN delivery.
- **AI Eval:** extraction correctness is format-specific deterministic or
  dataset evidence; no shared product-level quality Eval is currently claimed.
- **Release Check:** representative PDF/OCR/DOCX/media preparation with packaged native helpers, including no
  visible console or focus theft on Windows, remain release evidence.
- **Gap:** none in the deterministic source-to-current-evidence path.

## J05: Search

**Status:** Partial.

- **Contract Test:** `pnpm test:retrieval` and the data, scope, credential,
  and renderer suites cover exact filtering (including encoding-safe TXT), semantic mechanics, source
  remapping, access boundaries, account identity, and failure presentation.
  Python daemon tests additionally lock one MFS Internal namespace per Folder,
  visible relative DocumentIds, provider configuration, and rename/delete
  cleanup; keyword search remains provider-independent. Project operation and
  HTTP route tests also cover unbound and cross-project refusals, concurrent
  request attribution, and refusal of omitted reindex/directory scopes.
  Retrieval regressions cover deleted sources, failed/cancelled preparation,
  stale or incomplete output, and availability after legacy source remapping
  in both modes. Daemon regressions exercise nested ownership after existing
  parent indexing and restart, and responsive keyword/status
  requests while a local test embedder blocks semantic activation.
- **Driven Runtime Pass:** against a scratch profile with no embedding key,
  opening a folder and its search panel shows one field with no mode strip and
  no mention of search by meaning, and Settings shows the Search by Meaning
  section after Transcription as a single key row. The running desktop server
  also reconciled the built-in Start Here Folder and returned visible-source,
  untruncated matches through the live MFS exact-search route. A built desktop
  run against two scratch projects with the same query term verified one
  result from each namespace through the real daemon and only Project One's
  source in its sidebar search. Omitted search and reindex folders returned
  `400`. This pass used a local server without an embedding key; it does not
  claim semantic retrieval or native model-turn coverage. A subsequent built
  desktop pass indexed a nested source in its parent, registered the nested
  project, and verified old parent text disappeared while updated text was
  found only in the nested project. Deleting the source then hid its result
  without an explicit sync. This pass also used no embedding key. Journey automation
  retired with the Playwright suites.
  The same isolated built-server/Electron search pass was repeated on
  2026-09-14 with MFS `357fe2525d663f8d6b510db16b28c209f42f11b9` installed:
  parent projection retirement, child text updates, and deleted-source filtering
  passed. Python setup was also driven from the prior same-version MFS commit
  and repeated unchanged; installed Git provenance matched the requirements pin
  both times. These checks use the development Python runtime, not a packaged
  sidecar or a hosted embedding provider.
- **AI Eval:** `pnpm eval:semantic-retrieval` runs the versioned, synthetic
  [semantic retrieval dataset](../evals/semantic-retrieval/README.md) through
  the production index and Retrieval interfaces. It reports provider, model,
  dataset version, Recall@3, MRR, missed evidence, unexpected top results, and
  selected keyword-search comparisons against predeclared thresholds. It remains
  calibration evidence until three retained runs exist for both supported BYOK
  providers; the runner makes that gate state explicit. Ranking is scored over
  distinct sources, not chunks, and the corpus includes multi-chunk sources so
  chunking changes are actually observable.
- **Release Check:** the semantic AI Eval is credentialed BYOK release evidence,
  not required or scheduled CI, because it makes paid provider requests and
  allows bounded ranking variability.
- **Gap:** the semantic Eval is present but still in calibration: no baseline
  run is retained, so no
  semantic-quality gate is active yet. Completing the baselines and activating
  the thresholds is tracked in
  [GitHub issue #176](https://github.com/liliu-z/stashbase/issues/176).

## J06: Agent

**Status:** Release-dependent.

- **Contract Test:** `pnpm test:agent` and
  renderer tests cover consent, normalized protocol, scope, lifecycle,
  permissions, failed-install external recheck without another download,
  Claude mutation/unknown-tool approval and abort settlement, Codex history
  ownership checks before rename/delete (including persisted rebinds),
  managed Codex PowerShell path ownership and missing-output diagnostics,
  installed-but-signed-out Codex detection, same-executable browser login,
  recovery, transcript, the hover rows under prompts and settled replies
  (copy on both, edit on the latest settled prompt, send and settle times
  with the turn's duration), individually deletable waiting follow-ups,
  layout state, and structured folder-scope retirement
  for blank, draft-only, queued, and active-tool Chats. Workspace reset tests
  pin Chat preservation through both direct folder loss and 412 recovery.
  Broker and OpenCode translator tests preserve OpenQuill credit-exhaustion
  classification with current user-facing copy; turn-failure tests distinguish
  the per-turn spending limit and retain legacy error vocabulary. These tests
  use simulated provider responses, not a live credit reset or account balance.
  Account hook and account-entry tests cover stopping an abandoned browser
  wait, retry after a failed status check, and late-response isolation.
  Project-operation, route, retrieval, and renderer composition tests pin
  folder-Chat scope defaults, required Folder selection for unbound Chats and
  external callers, stale-attribution rejection, and prepared-source remapping.
  Project Operations and HTTP route tests exercise automatic grep/hybrid selection
  before key setup, after setup, and after removal; explicit hybrid without a
  key returns 412, and provider failures never invoke grep. MCP transport tests
  retain keyword/semantic wire compatibility while mapping internal modes and
  preserving omission for automatic selection. Agent Instructions
  config tests pin bounded folder isolation, strict persistence, and membership
  cleanup plus default restoration; Adapter tests pin verbatim runtime
  injection. Saving Instructions does not remount an existing session; the
  current editor persists guidance for subsequent mounts. These tests do not
  establish that a real model follows the project-writing default or keeps
  wiki maintenance conditional on the request.
  `renderer/src/app/composition/layout/workspace-titlebar.test.tsx` locks
  that New chat travels with the Chat pane and the titlebar's corner holds
  the panel toggle alone, and that the sidebar's Chats mode names the chat
  in the titlebar and takes the pane's row, its actions, and the toggle
  away until Documents mode brings them back;
  `renderer/src/app/composition/layout/agent-document-workspace.test.tsx`
  locks the document slot leaving the row inert in that mode; and
  `renderer/src/features/agent/ui/chats/history-popover.test.tsx` locks the
  header's history popover listing, filtering, and restoring a chat;
  `renderer/src/features/agent/ui/new-chat-button.test.tsx` locks the shared
  start.
  `pnpm test:opencode:native` starts the
  exact bundled OpenCode binary and completes an SDK session against a local
  fake OpenAI-compatible gateway; broker tests cover token isolation, streaming,
  refresh retry, per-session credentials, required UUID turn-header
  attribution across retries, stable model profile routing, and allowance
  classification. Config tests also prove that ambient credentials and process
  injection flags do not enter the bundled runtime.
- **Driven Runtime Pass:** 2026-09-11, built app launched in isolation
  (own user data, own port, scratch home, mock keychain) over a seeded
  Claude history session for a member folder. Restored the conversation from
  Chats, hovered the latest prompt and both closing replies, and measured the
  rows: the reply text, the collapsed tool group's header, and the reply's
  copy glyph shared one left edge; the prompt's edit glyph shared the
  bubble's right edge; the reply rows read the settle time with the turn's
  duration from the native timestamps; exactly one edit control rendered,
  and pressing it put the prompt back into the focused composer. A live
  turn's settle stamp is covered by the runtime test; no runtime was signed
  in under the scratch home, so no live turn was driven. 2026-09-13, the same
  isolated launch: the Chat pane's header carried New chat at its right end
  on the panel toggle's column, hiding the pane left no New chat in the
  titlebar and showing it brought the control back, and the Chats panel
  showed a rule under New chat and the Recent heading above its list.
  2026-09-14, an isolated Electron launch with the rebuilt server exercised
  window-authorized Agent file routes: source and manifest-known PDF reads
  agreed for a completed fixture, source modification made both return `409`
  and context unavailable, and source deletion made both return `404`.
  The preparation output was seeded; no native Agent or model turn was run.
- **AI Eval:** not required for panel and runtime correctness; actual
  task-quality evidence belongs to the J10 core loop.
- **Release Check:** packaged OpenCode version/executability plus a fake-gateway
  model turn that proves the signed runtime stays alive, a real hosted OpenQuill
  turn and allowance response, bring-your-own CLI/account setup,
  and bring-your-own clipboard image behavior remain release evidence.

## J07: Converge

**Status:** Release-dependent.

- **Contract Test:** Agent, MCP, file transaction, and Markdown suites prove
  the decisive Seams independently.
  MCP mutation tests exercise literal replacements, including dollar sequences,
  through the versioned file transaction.
- **Driven Runtime Pass:** 2026-09-14, the isolated built Electron app's
  window-authorized write/edit routes persisted literal dollar sequences under
  a source version check. This proves the file boundary only; selecting
  a requested draft or revision from a real Agent conversation still needs
  end-to-end proof.
- **AI Eval:** deterministic fake-Agent evidence can prove the write/review
  workflow; whether a real Agent writes the requested draft or revision
  belongs to J10 task-quality Eval. This is not document-diff quality evidence.
- **Release Check:** one real-runtime requested draft/revision and subsequent
  editor save remain release evidence; a Canvas is an optional document role.

## J08: External MCP

**Status:** Partial and release-dependent.

- **Contract Test:** `pnpm test:mcp`, `pnpm test:project-files`, and
  `pnpm test:retrieval` cover operation parity, transport, authorization,
  path confinement, direct and prepared text reads, text-format mutation
  boundaries, and reconcile.
  `server/project-file-reader.test.ts` covers context/read parity for current,
  stale, incomplete, cancelled, and orphaned PDF/DOCX/media text, including
  manifest-path scope checks and the bounded windowed-read contract.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** retrieval quality is shared with J05; client generation quality
  is outside StashBase ownership.
- **Release Check:** packaged launcher, copied configuration, URL access, and
  one representative external client remain release evidence.
- **Gap:** none in the deterministic transport, direct-text
  description/parity, or format-capability boundary; focused MCP mutations
  cover Markdown, JSON, and TXT plus invalid-encoding refusal and
  generic-file exclusion. Packaged launcher and third-party client behavior
  remain release evidence.

## J09: Bug report

**Status:** Partial and release-dependent.

- **Contract Test:** [collection](../electron/bug-report-collection.test.cjs),
  [review authority](../electron/bug-report-review.test.cjs),
  [redaction](../electron/bug-report-redaction.test.cjs), and
  [handoff](../electron/bug-report-handoff.test.cjs) prove the app-owned draft,
  privacy, approval, and artifact boundaries.
  Redaction tests include standalone home paths followed by prose whitespace
  or punctuation, while retaining longer quoted directory names and spaced
  path continuations.
- **Driven Runtime Pass:** the review window is driven through the real
  application, opened from Settings and taken through prepare, back, and
  cancel. An isolated Electron smoke also drives the built review through a
  privacy refusal, correction, exact sanitized log preview, preparation,
  Downloads copying, Back, and Cancel using synthetic log content and a
  temporary Downloads directory. It captures a fixture window rather than
  personal content. The development review uses the same validated bridge and
  is driven through edits during a delayed save and the final approval lock.
  Concurrent export failure and repair are focused filesystem evidence;
  packaged capture and external browser handoff remain release evidence.
- **AI Eval:** not required.
- **Release Check:** packaged capture, review, Downloads copy, and browser
  handoff remain release evidence.

## J10: Core loop

**Status:** Partial and release-dependent evidence for an implemented workflow.
Document-specific diff remains outside current completion claims.

- **Contract Test:** J02 and J06 cover project entry and Agent ownership;
  J03/J07 cover document editing and write boundaries. J04/J05/J08 provide
  supporting reference and external-client evidence when those paths are used.
  These lower-layer checks do not establish brainstorm usefulness.
- **Driven Runtime Pass:** no full project-entry → brainstorm → requested
  writing pass is recorded here. In particular, existing prepared-source and
  file-write passes do not prove that an empty project can reach useful
  discussion without a source, wiki, or index. No new runtime pass was run for
  the documentation baseline update.
- **AI Eval:** Gap. No representative Eval establishes useful idea development
  and requested writing across both empty and reference-filled projects.
  Source grounding matters when material is used; it is not a prerequisite for
  every brainstorming turn. Existing semantic retrieval quality evidence is
  narrower and cannot substitute for this.
- **Release Check:** drive a packaged project-bound conversation from an empty
  project, request a draft, inspect/edit/save it, and return to the work. Also
  cover a reference-assisted task with a supported native runtime. These checks
  verify current writing; they do not claim the unfinished refinement diff.

## J11: Conversation to project

This retained secondary route is not the project-first primary journey. Its
unavailable UI entry and native rebind limits remain documented as actual
boundaries, not additional feature commitments in the current roadmap.

**Status:** Partial and release-dependent.

- **Contract Test:**
  [project creation tests](../server/__tests__/agent-projects.test.ts) prove
  name and exact location validation, owned-root and symlink confinement,
  an empty project with no seeded instruction files, registration failure cleanup
  that preserves replacement directories and new files, refusal to borrow another
  Chat for missing/stale identity, history-write failure without live rebind,
  history override ordering, and rebind-race rollback.
  [project HTTP tests](../server/routes/project-files.test.ts) prove creation
  forwards absent, blank, and stale identity without inventing a default window
  or accepting model-controlled identity. Existing-file scope remains enforced.
  [MCP transport tests](../server/__tests__/mcp-http-transport.test.ts) prove
  attributed built-in calls and unattributed external calls remain distinct.
  [agent socket schema tests](../shared/protocols/websocket/agent-session.test.ts)
  prove the `scope-changed` event's shape and the refusal of a contradictory
  scope, and
  [session context tests](../renderer/src/features/agent/application/session-runtime.context.test.ts)
  prove the renderer applies a folder move to the live conversation and drops a
  send whose context resolved after it.
- **Driven Runtime Pass:** creation-service subflow only, 2026-09-14, isolated
  macOS application with the built renderer and server. HTTP creation under a
  trailing-space parent preserves that exact location, duplicate creation returns
  conflict, and stale identity creates without rebinding or changing the open
  window. This is not an end-to-end conversation-to-project pass: no live Agent
  rebind is driven, and the unbound Chat entry gap below remains.
- **AI Eval:** Gap. No representative real-Agent Eval proves that the Agent
  chooses `create_project` after an explicit project decision, avoids bare
  filesystem creation, and does not create a project merely because exploratory
  conversation sounds project-like.
- **Release Check:** one packaged real-runtime conversation-to-project flow on
  each supported path family remains release evidence after deterministic E2E
  exists.
- **Gap:** the journey's entry state cannot be reached from the product. Projects
  scope is implemented end to end, down to its own packaged instructions, but no
  window shows an unbound Chat: a window with no folder open renders the
  welcome screen rather than a Chat, and a folder window's Chats panel filters
  to that folder. So the conversation this journey starts from can be neither
  started nor returned to, and no evidence below can stand in for that. The
  owning gap is in
  [Agent Panel](../design-docs/design/agent-panel.md#no-surface-for-an-unbound-chat).
- **Gap:** real-Agent intent/tool choice still needs an Eval. Codex
  configuration leaves `create_project` on the default prompt path, but no
  focused test locks that tool allowlist; Claude requires equivalent focused
  or release evidence. OpenQuill can rebind the live panel and attributed
  MCP path, but OpenCode cannot yet migrate its native history/cwd; its restored
  row remains under unbound history and this path needs separate evidence after that
  native limitation is resolved.

## J12: Build Wiki Pages

**Status:** Partial and release-dependent.

- **Contract Test:** renderer domain tests cover the three runtime-gate states
  and the empty-chat requests, including that a folder with existing pages
  cycles the same wording; the rotation hook's cadence, pause, and wrap; and
  the editor taking a request placeholder on Tab and leaving a hint alone.
  Workspace tests cover the gated composer holding a request with Send
  unavailable and no runtime ability advertised, the stage-specific offer, the
  request surviving onto the runtime the reader sets up, and Tab filling the
  composer with the showing request without sending. Runtime tests cover a Chat no
  turn has left following an arriving runtime with its draft and bound sources,
  and a Chat that has spoken staying where it is. A composition test covers a
  request sending while the whole folder is still being prepared; the Agent
  surface takes no retrieval or embedding input at all, which the cross-feature
  import rule enforces. Story accessibility covers both the working
  conversation and the gate. Agent, file-transaction, and data-lifecycle suites
  cover approval, source confinement, write reconciliation, and index
  admission.
- **Driven Runtime Pass:** the renderer responsibilities are driven through the
  real application: with every runtime reported unable to carry a turn, the
  composer stays on screen with Send unavailable and each pending runtime named
  by its own stage; the Build Wiki request is typed into the gated composer and
  held; setting a runtime up clears the offer, restores the runtime controls,
  enables Send, and leaves the request intact. The Agent turn that produces the
  pages is not part of this pass — it writes real files and needs a real
  account — and stays release and Eval evidence below.
- **AI Eval:** Gap. The deterministic Agent proves orchestration and safety,
  not whether a real model produces useful, complete, well-linked Wiki Pages
  over representative mixed-format folders.
- **Release Check:** one packaged OpenQuill flow should cover independent
  account-required Agent setup and review of real generated Wiki Pages.
  BYOK activation/backfill for search by meaning is optional independent
  evidence; there is no hosted-account search source. Bring-your-own-key plus a
  real external Agent is representative secondary evidence.
- **Gap:** no real-Agent quality Eval yet covers folder-map completeness,
  source-link correctness, or preservation under ambiguous existing Wiki
  content. The first release intentionally claims no persistent ready/stale
  state, Update Wiki Pages label, or scheduled regeneration.

## J13: Gallery download

**Status:** Partial.

- **Contract Test:** the index contract is proven at the wire
  ([gallery.test.ts](../shared/protocols/http/gallery.test.ts)):
  whole-parse-or-whole-fallback, additive stripping, refusal of an entry
  missing a required field, and refusal of an index past its bound. Renderer
  tests cover the adapter's fallback and screenshot proxying
  ([gallery-api.test.ts](../renderer/src/features/gallery/infrastructure/gallery-api.test.ts)),
  snapshot enrichment of unpublished fields
  ([entry.test.ts](../renderer/src/features/gallery/domain/entry.test.ts)), the
  session-lived index and the one-at-a-time copy latch
  ([use-gallery.test.tsx](../renderer/src/features/gallery/hooks/use-gallery.test.tsx),
  [use-gallery-copy.test.ts](../renderer/src/features/gallery/hooks/use-gallery-copy.test.ts)),
  and that both entrances write one shop
  ([gallery-shop.test.tsx](../renderer/src/app/composition/gallery/gallery-shop.test.tsx)). [server/routes/gallery.test.ts](../server/routes/gallery.test.ts)
  covers the daemon proxy: upstream proxying with cache, the offline
  unsupported-schema envelope, invalid-index retry and mirror fallback, and
  normalized image URL validation with redirect refusal. The wire schema also
  refuses repositories the acquisition service cannot accept.
  [github-import tests](../server/__tests__/github-import.test.ts) cover the
  shared acquisition path, membership before return without window changes,
  and publication rollback on registration failure or cancellation.
- **Driven Runtime Pass:** the browse and inspect halves are driven through the
  real application on a clean profile. With no folder open and no click, the
  shelf derives on the welcome screen a bare window shows, from the bundled
  snapshot, with no account and no Agent runtime present. Clicking a card opens
  that entry's page carrying its introduction and, folded beneath it as its
  Agent Instructions, the request that produced the wiki. **Make a copy** is not pressed in this pass: it downloads a real public
  repository and registers a real project folder, so it stays release evidence
  below.
- **Driven Runtime Pass (copy):** 2026-09-14, isolated macOS application with
  the built renderer and server, a controlled Gallery index, and a real
  `octocat/Hello-World` clone. **Make a copy** registers the folder and opens a
  second window bound to it; the shop window keeps its original null binding.
  A separate pass injects native window-open failure and verifies that the
  downloaded directory and its project registration survive. OS key protection
  and URL registration are stubbed. This does not exercise published screenshots
  or a packaged build.
- **AI Eval:** none needed — the journey is deterministic acquisition and
  presentation; no model produces its content.
- **Release Check:** a packaged build should download one real entry
  end-to-end (published index, CDN screenshots, GitHub acquisition, new
  window on the copy).
- **Gap:** automated contracts use controlled upstreams; the published index
  and packaged acquisition still require release sanity. `learnMore`,
  `starterPrompts`, `contents`, and `files` ride the index contract but have
  no app surface.

## Maintenance Rule

Update a journey when its observable flow or Required Observable Results
change. Update this file when Area or Contract ownership, evidence type,
coverage status, or a residual check changes. A driven runtime pass should carry its
`Jxx` intent in a stable test name or tag; lower-level tests normally map to
their owning contract instead.

Do not add per-assertion rows, copied test counts, or broad commands as proof.
The test suite owns exact setup and assertions. Journey automation retired
with the Playwright suites, so a journey's end-to-end proof is a driven
runtime pass recorded in its owning task entry until a replacement instrument
is decided. Packaged checks live in
[UI Release Sanity](../release-checklists/ui-sanity.md).

### Known traceability gap

Journey titles predated the stable `Jxx` convention. The file
links above are therefore the current traceability authority, and documentation
validation checks that the files and reciprocal routes exist but cannot yet
verify intent from test metadata. Add a stable Journey tag when an affected E2E
is next changed; do not rename unrelated tests solely for documentation churn.

### Next: a replayable journey instrument

The Evidence Model above leaves a driven pass hand-produced "until a
replacement instrument is decided". That instrument is already in the tree and
wired to nothing. `electron/multi-window-smoke-runner.cjs` reserves a port,
builds an isolated temporary home, and launches real Electron once per script
against the real server; `electron/multi-window-smoke.cjs` and
`electron/markdown-tab-lifecycle-smoke.cjs` are the two journeys it drives. No
command reaches them, because the frontend migration repointed the smoke script
at the renderer boundary smoke in `electron/renderer/smoke.cjs`, which proves
the preload surface rather than a journey.

Neither runs against the replacement renderer as written. Both were built on a
`window.electron` bridge that is now `window.stashbase`, and both navigate to a
folder query string the renderer no longer reads; a folder is reached through
the project registry capability instead. A revival was driven to a green run locally and
covered part of J02 and part of J03, so the cost is known and bounded. It is
deliberately not part of this change.

After that, by proof value over cost: J05, then J01, then J06. J06 is the
largest uncovered surface and the only one needing new transport, a WebSocket
stub and synthesized input events, because its composer is not a plain field.
Three journeys do not belong on this instrument. J08 needs a real third-party
client and stays release evidence, J10 is a composite of journeys proven
piecewise, and the outcome J12 is named for is Agent-side.

Two failures cost the most to diagnose, so they are recorded rather than
rediscovered. A window whose project registry read does not answer never settles its
boot and sits on the welcome screen forever. An opened folder must appear both
as the current folder and as a member, or the workspace paints blank with no
error to explain it.

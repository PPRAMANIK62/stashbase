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
| [J13 Gallery download](../design-docs/user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery) | [Agent Panel](../design-docs/design/agent-panel.md), [Workspace](../design-docs/design/workspace.md) | [Agent Panel](agent-panel.md) |

## J01: Onboarding

**Status:** Release-dependent.

- **Contract Test:** renderer initialization, Settings state, workspace
  navigation, and Electron lifecycle are exercised by `pnpm test:renderer`,
  `pnpm test:config`, `pnpm test:updates`, and `pnpm test:electron:smoke`.
  The Settings and config suites cover hosted and BYOK choices for search by
  meaning, rejection of new local selection, deterministic retirement of
  persisted local selection before daemon startup, and transactional source
  activation that keeps the prior source selected when runtime reset or
  binding fails.
  Account identity fixtures cover profile normalization, migration, privacy,
  and UI fallbacks.
  Renderer state evidence keeps bootstrap settlement distinct from confirmed
  library membership, so a failed or pending membership load cannot claim the
  library is empty.
  The setup invitation for search by meaning is proven at three layers: a pure
  decision covering never-offered, answered, already-configured, bare-window,
  and raised-revision states; a hook covering the offer, the single durable
  answer however many times the reader clicks, and the refusal to offer before
  the stored answer has loaded; and a route test proving an unknown or
  malformed preference is refused rather than written into durable config.
  The visual suite reference above is historical: pixel baselines retired with
  the Playwright journeys.
  The Settings smoke drives the development-only update simulator through the
  production update-state bridge to verify available and ready update-banner
  behavior without claiming a packaged installation.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** onboarding mechanics are deterministic. If first value uses
  semantic retrieval or a real Agent, its quality evidence comes from J05 or
  J10 rather than being duplicated here.
- **Release Check:** Gatekeeper acceptance of the Developer ID-signed and
  notarized macOS artifact, packaged first launch, native folder selection,
  offline startup, one first-session-to-returning-session pass, and real
  N→N+1 desktop updates on supported platforms remain release evidence.
- **Gap:** no single driven runtime pass currently proves that a first-time user sees
  the source/derived/hosted distinction, authorizes useful content, reaches a
  concrete first result, and returns without unnecessary onboarding replay.
  The first local-model download and selection path is also lower-layer and
  packaged-release evidence rather than a complete driven runtime pass.

## J02: Folder

**Status:** Partial and release-dependent.

- **Contract Test:** workspace transitions, library mutation, cleanup, GitHub
  repository import (`server/__tests__/github-import.test.ts`,
  `web-src/src/features/workspace/__tests__/import-github-modal.test.ts`), and
  window retirement run through `pnpm test:renderer`,
  `pnpm test:library-files`, and `pnpm test:electron`.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** not required.
- **Release Check:** real operating-system folder picking, Git cloning of public
  repositories, and file drop remain release evidence.
- **Gap:** repository publication reserves the final directory without
  clobbering concurrent user state, but Node lacks a cross-platform atomic
  no-replace directory rename; see the File Transactions Known Gap.

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
  hidden-files persistence; renderer `hidden-entries.test.ts`,
  `hidden-files-menu.test.ts`, `hidden-visibility-actions.test.ts`, and
  `file-listing-generation.test.ts` lock row marking, checked semantics,
  rapid/failing writes, and stale continuation ownership.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
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
  `pnpm test:python` cover the default-off capture preference, scheduling,
  format completion, cancellation, PDF/OCR spawn configuration, freshness,
  checkpoints, and recovery. `pnpm test:package-inputs` locks the static
  Windows extractor bootloader argument wiring without discarding stderr.
  `pnpm test:electron` locks the focused-window and unclaimed-composer offer
  policy.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** extraction correctness is format-specific deterministic or
  dataset evidence; no shared product-level quality Eval is currently claimed.
- **Release Check:** operating-system screenshot capture and representative
  PDF/OCR/DOCX/media preparation with packaged native helpers, including no
  visible console or focus theft on Windows, remain release evidence.
- **Gap:** none in the deterministic screenshot-to-current-evidence path.

## J05: Search

**Status:** Partial.

- **Contract Test:** `pnpm test:retrieval` and the data, scope, credential,
  and renderer suites cover exact filtering (including encoding-safe TXT), semantic mechanics, source
  remapping, access boundaries, account identity, and failure presentation.
  Python daemon tests additionally lock the fixed ONNX model identity,
  provider/dimension collection separation, and cross-collection cleanup for
  renamed or deleted sources; keyword search remains provider-independent.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
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
  allows bounded ranking variability. Hosted account behavior remains
  lower-layer or release evidence.
- **Gap:** library-wide readiness is not yet Shipping. The semantic Eval is
  present but still in calibration: no baseline run is retained, so no
  semantic-quality gate is active yet. Completing the baselines and activating
  the thresholds is tracked in
  [GitHub issue #176](https://github.com/liliu-z/stashbase/issues/176).

## J06: Agent

**Status:** Release-dependent.

- **Contract Test:** `pnpm test:agent` and
  renderer tests cover consent, normalized protocol, scope, lifecycle,
  permissions, failed-install external recheck without another download,
  managed Codex PowerShell path ownership and missing-output diagnostics,
  installed-but-signed-out Codex detection, same-executable browser login,
  recovery, transcript, individually deletable waiting follow-ups, layout state,
  and structured folder-scope retirement
  for blank, draft-only, queued, and active-tool Chats. Workspace reset tests
  pin Chat preservation through both direct folder loss and 412 recovery.
  Library-operation, route, keyword-search, and renderer composition tests pin
  the per-session policy for search by meaning, Chat-scoped search defaults,
  explicit global search, stale-attribution rejection, library-wide text fallback, and
  prepared-PDF source remapping while the switch is Off. Agent Instructions
  config tests pin bounded folder isolation, strict persistence, and membership
  cleanup plus default restoration; Adapter tests pin verbatim runtime
  injection; a renderer composition
  test pins that a save remounts the sessions on that exact scope and leaves
  every other scope's session alone.
  `pnpm test:opencode:native` starts the
  exact bundled OpenCode binary and completes an SDK session against a local
  fake OpenAI-compatible gateway; broker tests cover token isolation, streaming,
  refresh retry, per-session credentials, required UUID turn-header
  attribution across retries, stable model profile routing, and allowance
  classification. Config tests also prove that ambient credentials and process
  injection flags do not enter the bundled runtime.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** not required for panel and runtime correctness; actual
  task-quality evidence belongs to the J10 core loop.
- **Release Check:** packaged OpenCode version/executability plus a fake-gateway
  model turn that proves the signed runtime stays alive, a real hosted Wiki Agent
  turn and allowance response, bring-your-own CLI/account setup,
  and bring-your-own clipboard image behavior remain release evidence.

## J07: Converge

**Status:** Release-dependent.

- **Contract Test:** Agent, MCP, file transaction, and Markdown suites prove
  the decisive Seams independently.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** deterministic fake-Agent evidence can prove the write/review
  workflow; whether a real Agent selects and writes the requested accepted
  content belongs to J10 task-quality Eval.
- **Release Check:** one real-runtime Canvas write remains release evidence.

## J08: External MCP

**Status:** Partial and release-dependent.

- **Contract Test:** `pnpm test:mcp`, `pnpm test:library-files`, and
  `pnpm test:retrieval` cover operation parity, transport, authorization,
  path confinement, direct and prepared text reads, text-format mutation
  boundaries, and reconcile.
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
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** not required.
- **Release Check:** packaged capture, review, Downloads copy, and browser
  handoff remain release evidence.

## J10: Core loop

**Status:** Partial and release-dependent.

- **Contract Test:** J02 and J04–J07 prove their owner Interfaces and recovery
  rules independently.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** Gap. No first-class representative dataset currently measures
  whether an Agent receives the relevant project evidence and produces a
  source-grounded result suitable for explicit writeback.
- **Release Check:** one packaged built-in or external Agent loop should remain
  a release check even after deterministic E2E and task-quality Eval exist.

## J11: Conversation to project

**Status:** Partial and release-dependent.

- **Contract Test:**
  [project creation tests](../server/__tests__/agent-projects.test.ts) prove
  name and location validation, owned-root and symlink confinement,
  an empty project with no seeded instruction files, membership failure cleanup, live Library-session
  attribution, history override ordering, and rebind-race rollback.
  [MCP transport tests](../server/__tests__/mcp-http-transport.test.ts) prove
  attributed built-in calls and unattributed external calls remain distinct.
  [renderer scope tests](../web-src/src/features/agent-panel/__tests__/agent-folder-pill.test.ts)
  prove the Library-to-folder scope presentation.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** Gap. No representative real-Agent Eval proves that the Agent
  chooses `create_project` after an explicit project decision, avoids bare
  filesystem creation, and does not create a project merely because exploratory
  conversation sounds project-like.
- **Release Check:** one packaged real-runtime conversation-to-project flow on
  each supported path family remains release evidence after deterministic E2E
  exists.
- **Gap:** real-Agent intent/tool choice still needs an Eval. Codex
  configuration leaves `create_project` on the default prompt path, but no
  focused test locks that tool allowlist; Claude requires equivalent focused
  or release evidence. Wiki Agent can rebind the live panel and attributed
  MCP path, but OpenCode cannot yet migrate its native history/cwd; its restored
  row remains under Library and this path needs separate evidence after that
  native limitation is resolved.

## J12: Build Wiki Pages

**Status:** Partial and release-dependent.

- **Contract Test:** renderer domain tests cover the three runtime-gate states
  and the starter row, including that a folder with existing pages is offered
  the same wording. Workspace tests cover the gated composer holding a request
  with Send unavailable and no runtime ability advertised, the stage-specific
  offer, the request surviving onto the runtime the reader sets up, and the
  starter filling the composer without sending. Runtime tests cover a Chat no
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
- **Release Check:** one packaged Wiki Agent flow should cover independent
  account-required Agent setup, hosted activation/backfill for search by
  meaning, and review of real generated Wiki Pages. Bring-your-own-key plus a
  real external Agent is representative secondary evidence.
- **Gap:** no real-Agent quality Eval yet covers folder-map completeness,
  source-link correctness, or preservation under ambiguous existing Wiki
  content. The first release intentionally claims no persistent ready/stale
  state, Update Wiki Pages label, or scheduled regeneration.

## J13: Gallery download

**Status:** Partial.

- **Contract Test:** renderer tests
  ([gallery.test.ts](../web-src/src/features/templates/__tests__/gallery.test.ts))
  cover the index contract: whole-parse-or-whole-fallback, session
  caching, fallback-not-cached, and snapshot enrichment of unpublished
  fields. [server/routes/gallery.test.ts](../server/routes/gallery.test.ts)
  covers the daemon proxy: upstream proxying with cache, the offline
  unsupported-schema envelope, and the image route refusing non-gallery
  hosts. [github-import tests](../server/__tests__/github-import.test.ts)
  cover the shared acquisition path.
- **Driven Runtime Pass:** none recorded. Journey automation retired with
  the Playwright suites; this journey has no end-to-end proof until one is
  driven and recorded.
- **AI Eval:** none needed — the journey is deterministic acquisition and
  presentation; no model produces its content.
- **Release Check:** a packaged build should download one real entry
  end-to-end (published index, CDN screenshots, GitHub acquisition, new
  window on the copy).
- **Gap:** no automated evidence exercises a real download or the
  published index; both stay release sanity. `learnMore` and
  `starterPrompts` ride the index contract but have no app surface yet.

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

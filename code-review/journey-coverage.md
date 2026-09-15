# Journey Coverage

Start here for a journey review: choose its boundary and implementation entry
points, then inspect the code and evidence. [User Journeys](../design-docs/user-journeys.md)
states required outcomes; [Engineering Boundaries](architecture.md) owns invariants.
Tests own fixtures and exact assertions. This is not a source inventory or a review-completion percentage.

## Evidence Model

| Evidence | Establishes |
|---|---|
| Contract Test | Deterministic interfaces, invariants, failures, and recovery at the lowest useful layer |
| Driven Runtime Pass | A named observable flow through the built app, within its recorded substitutions and limits |
| AI Eval | Probabilistic retrieval, grounding, or task quality on representative inputs |
| Release Check | Packaged, native, credentialed, or third-party behavior unavailable to source tests |

**Covered** requires decisive evidence for every Required result. **Partial**
means some results lack it. **Release-dependent** reserves named external or
packaged checks. **Gap** identifies contradicted or unproven behavior. These
labels concern evidence, not feature completion; document-specific diff remains
outside current completion claims. A broad command or passing count is not proof.

Format evidence follows the [Documents capability matrix](../design-docs/design/writing-workspace.md#format-capability-matrix):
editable prose/structured text, preview-only text, prepared binary documents,
OCR images, and transcript media. One representation cannot prove another.

## Traceability Map

| Journey | Product areas | Engineering boundary |
|---|---|---|
| [J01 Onboarding](#j01-onboarding) | [Writing Workspace](../design-docs/design/writing-workspace.md), [Project Context](../design-docs/design/project-context.md) | [Entry and identity](architecture.md#project-scope-and-paths), [Native lifecycle](architecture.md#native-lifecycle-and-updates) |
| [J02 Folder](#j02-folder) | [Writing Workspace](../design-docs/design/writing-workspace.md) | [Projects](architecture.md#project-scope-and-paths), [Import](architecture.md#import-publication) |
| [J03 Documents](#j03-documents) | [Writing Workspace](../design-docs/design/writing-workspace.md) | [Source transactions](architecture.md#source-transactions), [Renderer](architecture.md#renderer-boundaries), [Recovery](architecture.md#recovery-journal) |
| [J04 Preparation](#j04-preparation) | [Project Context](../design-docs/design/project-context.md) | [Preparation](architecture.md#preparation-and-retrieval), [Local components](architecture.md#optional-local-components) |
| [J05 Search](#j05-search) | [Project Context](../design-docs/design/project-context.md), [Writing Workspace](../design-docs/design/writing-workspace.md) | [Retrieval](architecture.md#preparation-and-retrieval), [Scope](architecture.md#project-scope-and-paths) |
| [J06 Agent](#j06-agent) | [Writing Workspace](../design-docs/design/writing-workspace.md) | [Agent sessions](architecture.md#agent-sessions-and-permissions), [Credentials](architecture.md#credentials-and-external-access) |
| [J07 Converge](#j07-converge) | [Writing Workspace](../design-docs/design/writing-workspace.md) | [Source transactions](architecture.md#source-transactions), [Agent permissions](architecture.md#agent-sessions-and-permissions) |
| [J08 External MCP](#j08-external-mcp) | [Project Context](../design-docs/design/project-context.md), [Writing Workspace](../design-docs/design/writing-workspace.md) | [MCP](architecture.md#credentials-and-external-access), [Scope](architecture.md#project-scope-and-paths) |
| [J09 Bug report](#j09-bug-report) | [Writing Workspace](../design-docs/design/writing-workspace.md) | [Bug report](architecture.md#bug-report), [Native lifecycle](architecture.md#native-lifecycle-and-updates) |
| [J10 Core loop](#j10-core-loop) | [Writing Workspace](../design-docs/design/writing-workspace.md), [Project Context](../design-docs/design/project-context.md) | [Ownership](architecture.md#runtime-ownership), [Agent sessions](architecture.md#agent-sessions-and-permissions), [Source transactions](architecture.md#source-transactions) |
| [J11 Conversation to project](#j11-conversation-to-project) | [Writing Workspace](../design-docs/design/writing-workspace.md) | [Projects](architecture.md#project-scope-and-paths), [Session rebind](architecture.md#agent-sessions-and-permissions) |
| [J12 Build Wiki Pages](#j12-build-wiki-pages) | [Writing Workspace](../design-docs/design/writing-workspace.md), [Project Context](../design-docs/design/project-context.md) | [Agent permissions](architecture.md#agent-sessions-and-permissions), [Preparation](architecture.md#preparation-and-retrieval) |
| [J13 Gallery download](#j13-gallery-download) | [Writing Workspace](../design-docs/design/writing-workspace.md) | [Gallery](architecture.md#gallery), [Import](architecture.md#import-publication) |

## J01: Onboarding

**Usage statistics:** `server/telemetry.ts` and `server/routes/telemetry.ts` own
manual collection and Settings persistence; Settings General and the first-launch
notice expose default-on disclosure and opt-out. `server/telemetry.test.ts` covers
field rejection, opt-out/restart/ID rotation, offline delivery, corrupt config,
and daily editor-save suppression. Renderer usage tests cover terminal event
coalescing and Settings choice/failure UI. A 2026-09-15 built-service pass with
isolated config, real Python/MFS, and a local capture sink exercised project open,
versioned editor save, opt-out, ID removal, and suppression of later events.
Built Storybook controls and disclosure were driven and reviewed visually;
Electron boundary/authorization smoke passed. A separate real PostHog Capture
API pass received HTTP 200 for `app_opened` and `telemetry_disabled`, both visible
in project 384555 with version `2.7.0-telemetry-verification`. IP discard was
confirmed enabled there. Signed packaged multi-window disclosure and real-provider
Agent telemetry remain unproven; desktop accessibility selected a pre-existing
app instance rather than the isolated verification window.


**Intent:** [J01](../design-docs/user-journeys.md#j01-complete-onboarding-and-reach-first-value).

**Implementation:** Renderer: `renderer/src/app/bootstrap/startup.tsx`, `renderer/src/features/workspace/ui/welcome.tsx`.
Host/services: `electron/main.cjs`, `server/folder.ts`.

**Status:** Release-dependent.

- **Contract Test:** startup ownership/readiness, native activation and window
  isolation, registry/seeding/restart, Settings persistence, account entry,
  Agent preparation, and update state/authorization. Entry points:
  `pnpm test:renderer`, `pnpm test:config`, `pnpm test:project-files`,
  `pnpm test:updates`, `pnpm test:electron`, `pnpm test:electron:smoke`,
  and `pnpm test:agent`. Key persistence survives daemon reconfiguration
  failure; these tests do not prove rollback of saved configuration.
- **Driven Runtime Pass:** isolated macOS built-app passes cover Welcome/Recent,
  return without automatic project reopen, independent windows, orphan recovery,
  delayed-start activation, initial seeding, save-refused quit and later reopen,
  and theme writes. OS URL registration/key protection are substitutes.
  Account identity/menu is tested; a seeded session did not prove live sign-in.
  A built-server delayed fake-Codex pass (2026-09-15) kept health requests
  responsive and issued one probe; it proves liveness, not a model turn.
  Controlled updater passes cover dismissed notices, Settings actions, native
  input locking, save barriers, and handoff failure rollback, not replacement.
- **AI Eval:** first-discussion quality belongs to J10; retrieval quality to J05.
- **Release Check:** signed/notarized first launch, offline startup, actual
  native picker, first-session-to-returning-session flow, and N→N+1 updates on
  supported platforms. Transcription model download/selection needs packaged
  evidence beyond lower-layer checks.
- **Gap:** no full pass demonstrates understanding local/derived/hosted data,
  entering an empty project, useful brainstorming, and returning without
  unnecessary onboarding. Real update download, replacement, and relaunch remain
  unproven by controlled handoff; unpackaged builds report unsupported.
- **Known issues:** saved appearance applies after first paint. The composer
  cannot sign in directly; its setup action can stop at account-required and
  needs Agent Settings. The shared account provider and Agents Settings retain
  separate consumers, so one sign-in flight across all entry points is not proven.

## J02: Folder

**Intent:** [J02](../design-docs/user-journeys.md#j02-add-and-open-a-folder).

**Implementation:** Renderer: `renderer/src/features/workspace/application/open-folder.ts`, `renderer/src/features/workspace/application/remove-folder.ts`.
Host/services: `server/folder.ts`, `server/github-import.ts`, `server/project-file-mutations.ts`.

**Status:** Partial and release-dependent.

- **Contract Test:** `pnpm test:renderer`, `pnpm test:project-files`,
  `pnpm test:conversion-scheduler`, and `pnpm test:electron` cover asynchronous
  open/commit, cancellation, GitHub staging/publication rollback, project
  retirement, retained nested projects and preparation, and distinct path
  whitespace/case/Unicode identities. Scoped HTTP/Agent regressions now preserve
  a trailing-space project through reads, saves, and index status.
- **Driven Runtime Pass:** isolated macOS built app/server (2026-09-14): existing
  open, failed-open retention, alias focus, empty creation, duplicate rejection,
  registration without unrelated window rebind, introduction seeding, and a real
  shallow `octocat/Hello-World` clone. Picker selection/creation, URL registration,
  and key protection are substituted. The Git pass does not prove background
  listing/index completion. A 2026-09-15 built-service HTTP pass with the real
  Python/MFS daemon additionally preserved a trailing-space project through
  open/read/save/search and rejected a save from another window request scope.
  This is API evidence, not a new full UI pass; desktop control permission was
  unavailable during the v2.7.0 retry.
- **AI Eval:** not required.
- **Release Check:** real OS folder picker, file drop, and packaged public Git import.
- **Gap:** no cross-platform atomic no-replace directory publication primitive;
  concurrent user additions/edits must survive rollback. See
  [File Transactions](architecture.md#import-publication).

## J03: Documents

**Intent:** [J03](../design-docs/user-journeys.md#j03-read-and-edit-source-documents).

**Implementation:** Renderer: `renderer/src/features/documents/ui/source/registry.tsx`, `renderer/src/features/documents/application/document-runtime.ts`, `renderer/src/features/documents/ui/markdown/document.tsx`.
Host/services: `server/file-save.ts`, `server/text-file-transaction.ts`, `server/recovery-journal.ts`.

**Status:** Release-dependent.

- **Contract Test:** `pnpm test:renderer`, `pnpm test:project-files`,
  `pnpm test:electron`, and `pnpm test:electron:smoke` cover format capabilities, source identity,
  hidden-file policy, tab/history behavior, save barriers, shared version
  authority, conflicts, encrypted recovery journals, and failure handling.
  `pnpm test:config` covers strict durable preferences and recovery default-off.
  Transaction/Python regressions cover concurrent saves, staging-time external
  edits, failed empty-source removal with same-content retry, and consecutive
  projection acceptance while a local embedder blocks. They do not establish
  provider completion or search latency during a pending revision.
  HTTP source-format contracts isolate index admission; they do not start or
  verify the Python daemon. Real daemon lifecycle belongs to Electron smoke
  and the built-service pass below.
- **Driven Runtime Pass:** isolated built-app passes cover crash → journal offer
  → restore dirty text → versioned autosave → journal clearing with a stand-in
  keyring; distinct whitespace recovery identities; preview reuse/keep, history,
  draft creation/rename, and kept-only tab restoration. A separate window-origin
  API pass proves one success/one conflict for same-version saves and missing
  asset refusal; it does not drive editor typing or conflict-dialog decisions.
  The 2026-09-15 v2.7.0 retry exercised the built service with a real Python/MFS
  daemon: consecutive versioned saves, stale-write rejection with source
  preservation, empty-source removal from keyword results, and rejection of
  blank Agent identity and cross-project writes. No embedding key was configured;
  this pass does not establish real-provider latency or ranking quality.
- **AI Eval:** not required.
- **Release Check:** representative complex PDF/DOCX/media in packaged viewers.
- **Gap:** focused tests establish deterministic save/conflict behavior, but
  complete editor navigation under the save barrier and external-write conflict
  decisions still need a built-app pass. Retired journey tests are not current
  replayable evidence. See [conflict recovery](architecture.md#source-transactions).
- **Known issues — source/viewers:** failed asset refetch blanks a usable preview;
  Markdown relative images lack folder-scoped resolution/upload/lightbox; heading
  ids are assigned by order without identity cross-check. PDF placeholder/observer
  counts and media transcript rows are unbounded. Active-line paint is not focus-scoped.
  Markdown retention remains a format-name exception outside the registry.
  Renderer LF normalization falls short of source-convention preservation.
- **Known issues — work continuity:** history restores destinations/anchors, not
  reading offsets; sidebar resizing is pointer-only. Native close tracks document
  load rather than separate save-handler readiness, with failure/timeout keeping
  the window open. Recovery is a React remount, not a native reload protocol.
- **Known issues — journal:** storage/key ownership is not an accepted design
  decision. Disabled protection lacks visible explanation; wire character and
  stored byte limits disagree; two-window writers have no decisive test. Clean
  exit can offer saved text, removed-project drafts wait out retention unoffered,
  and key loss/limits/eviction can remove recovery without a clear user explanation.
  Do not expand the trust contract until its decision is settled.
- **Known issues — trust:** executable source HTML and remote subresources remain
  weaker than intended isolation. The current opaque frame is not approval to
  expand script/network authority.

## J04: Preparation

**Intent:** [J04](../design-docs/user-journeys.md#j04-prepare-a-hard-to-read-file).

**Implementation:** Renderer: `renderer/src/features/preparation/public.ts`.
Host/services: `server/conversion-dispatch.ts`, `server/conversion-scheduler.ts`, `server/extractor-runtime.ts`, `server/sync.ts`.

**Status:** Release-dependent.

- **Contract Test:** `pnpm test:config`, `pnpm test:conversion-scheduler`,
  `pnpm test:python`, and `pnpm test:package-inputs` cover format completion,
  freshness, checkpoints, cancellation including descendants, media handoff,
  native worker wiring, and bounded component install/retry/offline reuse.
  Native media builds probe their staged decoding and playback executables.
- **Driven Runtime Pass:** isolated macOS built app/server (2026-09-14): real
  native inference over synthetic AVI with a local tiny model, Japanese override,
  final transcript, and ranged WebM playback. No real-speech recognition quality
  or player interaction is established. PDF/OCR recovery (2026-09-15) covers
  failed first demand, no polling retries, one Settings retry, next-launch
  download/resume, and a later offline process with zero downloads. It uses a
  retained component build and controlled transport; picker/key storage are
  substitutes in both passes.
- **AI Eval:** no shared extraction-quality Eval claimed; correctness requires
  format-specific fixtures or datasets.
- **Release Check:** representative native PDF/OCR/DOCX/media, live component
  delivery/notarization, and no console/focus theft on Windows.
- **Gap:** no identified deterministic source-to-current-evidence gap; runtime
  substitutes do not establish fresh packaged delivery or real-speech quality.

## J05: Search

**Intent:** [J05](../design-docs/user-journeys.md#j05-search-and-open-source-evidence).

**Implementation:** Renderer: `renderer/src/features/retrieval/ui/project-search.tsx`, `renderer/src/features/retrieval/ui/search/backends.ts`.
Host/services: `server/retrieval/index.ts`, `server/indexer.mfs.ts`, `python/stashbase_daemon.py`.

**Status:** Partial.

- **Contract Test:** `pnpm test:retrieval`, `pnpm test:python`, and the scoped
  project/config/renderer suites cover exact filtering, hybrid mechanics,
  current-source mapping, namespace isolation including nested projects,
  missing/blank/stale identity refusal, provider-independent keyword search,
  and current/failed/cancelled preparation. A real-daemon deletion-failure
  probe verifies cleared text cannot leak old evidence and identical save retries.
  A local blocked embedder exercises independent keyword/status responsiveness.
- **Driven Runtime Pass:** no-key built-app passes prove keyword-only UI and
  Settings entry, Start Here exact retrieval, separate project results, omitted
  scope refusal, nested namespace retirement/update, and deleted-source filtering.
  Nested ownership was repeated on 2026-09-14 against MFS `357fe252`, and setup
  provenance matched the pin after replacement and a no-op rerun. These use the
  development Python runtime, not packaged sidecars or real embedding providers.
- **AI Eval:** `pnpm eval:semantic-retrieval` runs the versioned
  [dataset](../evals/semantic-retrieval/README.md) through production interfaces,
  reporting distinct-source Recall@3/MRR, misses, unexpected hits, and selected
  keyword comparisons. Multi-chunk fixtures expose chunking changes. Activation
  requires three retained runs for each supported BYOK provider.
- **Release Check:** credentialed OpenAI/OpenRouter evaluations; paid and variable
  provider requests are not source CI.
- **Gap:** no retained baseline, so thresholds remain in calibration; see
  [issue #176](https://github.com/liliu-z/stashbase/issues/176).

## J06: Agent

**Intent:** [J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat).

**Implementation:** Renderer: `renderer/src/features/agent/application/workspace-runtime.ts`, `renderer/src/features/agent/application/session-runtime.ts`.
Host/services: `server/agent-contract.ts`, `server/agent-adapters.ts`, `server/agent-runtime-installer.ts`.

**Status:** Release-dependent.

- **Contract Test:** `pnpm test:agent`, renderer, project-operation, MCP, and
  config suites cover setup/consent, authentication, scope, permissions,
  queue/turn/history ownership, stop/retirement, failure classification,
  instructions, and transcript/layout state. Automatic grep/hybrid selection
  follows current key configuration; explicit/provider failures do not silently
  change strategy. Instructions save for later mounts, not the current session.
  `pnpm test:opencode:native` completes a turn with the bundled executable and a
  local fake gateway; broker suites cover token/turn isolation, retry, and credits.
- **Driven Runtime Pass:** isolated built-app seeded-Claude-history passes
  exercise restore, copy/edit actions, timestamps, and Chat-pane controls without
  a live signed-in runtime. A window-authorized read pass (2026-09-14) proves
  source/prepared-path parity and stale/deleted-source refusal with seeded PDF
  output, not a native preparation or model turn.
- **AI Eval:** mechanics do not establish prompt adherence or writing quality;
  see J10 and J12.
- **Release Check:** signed bundled OpenCode executability plus a fake-gateway
  turn, a real hosted OpenQuill turn/credit response, external CLI installation
  and browser authentication, and runtime-supported clipboard image attachment.
  This is attachment support, not the removed clipboard screenshot capture.
- **Known issues:** classified failures share a resend card, which cannot repair
  expired auth, exhausted credits, or access restrictions. Instructions apply at
  the next mount without UI explanation. Replies lack math rendering; scrolling
  controls pinning without a jump-to-latest action. Editing historical prompts
  cannot recover attachment bytes. These limitations are not new feature promises.

## J07: Converge

**Intent:** [J07](../design-docs/user-journeys.md#j07-converge-chat-into-a-document).

**Implementation:** Renderer: `renderer/src/features/agent/application/session-runtime.ts`, `renderer/src/features/documents/application/document-runtime.ts`.
Host/services: `server/project-file-mutations.ts`, `server/text-file-transaction.ts`.

**Status:** Release-dependent.

- **Contract Test:** `pnpm test:agent`, `pnpm test:mcp`,
  `pnpm test:project-files`, and `pnpm test:renderer` establish permission, version, and write boundaries, including literal
  dollar-sequence replacement.
- **Driven Runtime Pass:** isolated built-app window-authorized write/edit
  (2026-09-14) persists literal replacements with version checks. It proves the
  file boundary, not a real conversation producing a requested draft/revision.
- **AI Eval:** requested writing quality belongs to J10. Existing deterministic
  orchestration evidence is not document-specific diff evidence.
- **Release Check:** real-runtime requested draft/revision followed by editor save.

## J08: External MCP

**Intent:** [J08](../design-docs/user-journeys.md#j08-connect-an-external-agent-through-mcp).

**Implementation:** Renderer: `renderer/src/features/settings/ui/mcp/mcp-access-panel.tsx`.
Host/services: `server/project-operations/index.ts`, `mcp/server.ts`, `server/routes/mcp-http.ts`, `server/mcp-http-service.ts`.

**Status:** Partial and release-dependent.

- **Contract Test:** `pnpm test:mcp`, `pnpm test:project-files`, and
  `pnpm test:retrieval` cover transport/operation parity, authorization, scoped
  direct/prepared reads, bounded windows, format/encoding restrictions, mutations,
  and reconcile. Current/stale/cancelled/orphaned prepared evidence is covered.
- **Driven Runtime Pass:** none recorded; no current end-to-end client proof.
- **AI Eval:** retrieval quality is J05; client generation is outside app ownership.
- **Release Check:** packaged launcher, copied configuration, URL access, and a
  representative external client.
- **Gap:** deterministic boundaries have focused evidence; third-party connection
  and packaged launcher use remain unproven by those suites.

## J09: Bug report

**Intent:** [J09](../design-docs/user-journeys.md#j09-prepare-and-hand-off-a-bug-report).

**Implementation:** Renderer: `renderer/src/features/bug-report/application/review-runtime.ts`.
Host/services: `electron/bug-report-service.cjs`, `electron/bug-report-handoff.cjs`, `electron/bug-report/review-ipc.ts`.

**Status:** Partial and release-dependent.

- **Contract Test:** [collection](../electron/bug-report-collection.test.cjs),
  [review authority](../electron/bug-report-review.test.cjs),
  [redaction](../electron/bug-report-redaction.test.cjs), and
  [handoff](../electron/bug-report-handoff.test.cjs) establish privacy,
  snapshot approval, and artifact ownership, including spaced-path redaction.
- **Driven Runtime Pass:** built review opened from Settings, prepare/back/cancel;
  isolated Electron smoke covers privacy refusal/correction, sanitized log preview,
  Downloads copying, delayed-save edits, and approval locking using synthetic
  logs, a fixture capture window, and temporary Downloads. Export repair is
  focused filesystem evidence, not a packaged external handoff.
- **AI Eval:** not required.
- **Release Check:** packaged native capture, review, Downloads copy, browser handoff.

## J10: Core loop

**Intent:** [J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work).

**Implementation:** Renderer: `renderer/src/app/composition/folder/use-agent-environment.ts`, `renderer/src/app/composition/folder/refresh-folder.ts`.
Host/services: `assets/agent-instructions/default.md`; follow J02/J03/J05/J06/J07 owners for the exercised path.

**Status:** Partial and release-dependent evidence for implemented writing.

- **Contract Test:** J02/J06 establish entry and Agent ownership, J03/J07 writing,
  and J04/J05/J08 supporting references/client paths. These do not prove usefulness.
- **Driven Runtime Pass:** no complete enter project → brainstorm → requested
  writing → return pass, especially from an empty project without a wiki/index.
- **AI Eval:** Gap. No representative useful-idea-development and requested-writing
  Eval over empty and reference-filled projects. Grounding is required when
  sources are used, not a prerequisite for every brainstorm. J05 is narrower.
- **Release Check:** packaged empty-project discussion, requested draft,
  inspection/edit/save, and return; also a reference-assisted native-runtime task.
  These verify current writing, not the unfinished document-specific diff.

## J11: Conversation to project

**Intent:** [J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project).

**Implementation:** Renderer: `renderer/src/features/agent/application/workspace-runtime.ts`.
Host/services: `server/agent-projects.ts`, `server/agent-session-folders.ts`, `server/routes/project-files.ts`.

Retained secondary boundary; its unavailable UI entry is not a new feature commitment.

**Status:** Partial and release-dependent.

- **Contract Test:** [creation](../server/__tests__/agent-projects.test.ts),
  [HTTP](../server/routes/project-files.test.ts), MCP, socket-schema, and renderer
  session-context suites establish authorized new-directory creation, exact paths,
  no instruction seeding, registration rollback, caller attribution, durable
  history-before-rebind ordering, race rollback, and late-send refusal.
- **Driven Runtime Pass:** creation-service subflow only (2026-09-14), isolated
  built app: trailing-space parent, duplicate conflict, and stale caller creating
  without rebinding another window. No live unbound conversation/rebind is driven.
- **AI Eval:** Gap. No real-Agent evidence of choosing `create_project` only after
  an explicit decision, avoiding bare filesystem creation and speculative projects.
- **Release Check:** after entry/continuation gaps are resolved, a real-runtime
  conversation-to-project flow on supported path families.
- **Gap:** [unbound Chat entry is unavailable](../design-docs/design/writing-workspace.md#no-surface-for-an-unbound-chat).
  Codex tool approval configuration and equivalent Claude behavior still need
  focused/release evidence. OpenQuill rebinds live panel/MCP scope but cannot yet
  migrate OpenCode native history/cwd; restored history remains unbound.
- **Known issues:** session scope rebind does not enter the new project in the
  originating window or select that conversation there. Failed override persistence
  must keep the created project registered without claiming successful rebind.

## J12: Build Wiki Pages

**Intent:** [J12](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder).

**Implementation:** Renderer: `renderer/src/features/agent/domain/starters.ts`, `renderer/src/features/agent/application/session-runtime.ts`.
Host/services: `assets/agent-instructions/default.md`, `server/project-file-mutations.ts`, `server/sync.ts`.

**Status:** Partial and release-dependent.

- **Contract Test:** renderer suites cover runtime gates, starter rotation,
  Tab filling without send, retained requests during setup, blank-chat runtime
  adoption, and sending without waiting for folder preparation. Agent, file, and
  data validation covers approvals, confinement, reconciliation, and admission.
- **Driven Runtime Pass:** real-app gated composer retains a typed Build Wiki
  request through runtime setup and restores Send without sending automatically.
  No real Agent page-generation turn is part of this pass.
- **AI Eval:** Gap. No representative mixed-format Eval of completeness, source
  links, useful pages, requested scope, and preservation of existing wiki content.
- **Release Check:** real packaged OpenQuill setup and generated-page review;
  optional BYOK indexing and an external Agent are separate secondary checks.
- **Gap:** model quality remains unproven; persistent ready/stale wiki state,
  scheduled rewriting, and an Update Wiki Pages mode are not product promises.

## J13: Gallery download

**Intent:** [J13](../design-docs/user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery).

**Implementation:** Renderer: `renderer/src/app/composition/gallery/use-gallery-shop.tsx`, `renderer/src/features/gallery/hooks/use-gallery-copy.ts`.
Host/services: `server/routes/gallery.ts`, `server/github-import.ts`, `electron/multi-window.cjs`.

**Status:** Partial.

- **Contract Test:** `pnpm test:protocols`, `pnpm test:renderer`, and
  `pnpm test:project-files` cover bounded whole-index
  parsing/fallback, image-host and redirect restrictions, cached browsing, copy
  serialization, and shared GitHub acquisition/publication rollback. See
  [Gallery boundary](architecture.md#gallery).
- **Driven Runtime Pass:** clean-profile bundled browsing and detail/Instructions
  inspection without account/runtime. A separate isolated built-app pass
  (2026-09-14) copies real `octocat/Hello-World` via a controlled Gallery index,
  registers it, opens a second bound window, and preserves the shop's null binding.
  Injected window-open failure preserves the copy/registration. OS key/URL setup
  is substituted; live screenshots and packaged delivery are not exercised.
- **AI Eval:** not required; acquisition does not generate content.
- **Release Check:** published index, CDN screenshots, real copy, and new window
  in one packaged pass.
- **Gap:** controlled upstreams do not establish published delivery. Wire fields
  `learnMore`, `starterPrompts`, `contents`, and `files` have no app surface.

## Maintenance Rule

Update this map when ownership, evidence, status, or a residual check changes.
Keep stable Jxx anchors; record decisive behavior and substitutions, not copied
assertions/counts or execution diaries. Detailed new runs belong to the owning
change record. [UI Release Sanity](../release-checklists/ui-sanity.md) owns the
packaged checklist. Documentation validation checks links and reciprocal routes,
not the truth of a test's claims or intent metadata.

## Cross-cutting Gaps

- No measured startup, interaction, long-task, disposal-memory, or bundle-size
  budgets. Token/source gates do not measure runtime performance.
- HTTP has no bounded reconnect ladder; recovery is polling or explicit retry.
  Settings lacks a local render boundary, so a render failure remounts the shell.
- No automated painted contrast, overlay stacking, or composed density/icon/fill
  consistency gate. The separate `pnpm test:renderer:a11y` sweep runs Story
  interactions and structural axe checks once in default/light appearance;
  it is part of `check:web`, not the focused renderer suite. Neither it nor
  token checks establishes painted behavior.
- Full journey automation and pixel baselines are absent. Electron smoke does
  exercise launch/preload and selected boundaries. Retained
  `electron/multi-window-smoke-runner.cjs`, `electron/multi-window-smoke.cjs`, and
  `electron/markdown-tab-lifecycle-smoke.cjs` are not wired into a current command;
  earlier local adaptations are not replayable gates. A future harness must use
  the current preload/registry contracts and state its Jxx intent. J10/J08/J12
  still require the flow/client/quality evidence described above.

These are engineering or evidence limitations, not additional product features.

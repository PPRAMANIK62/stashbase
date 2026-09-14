# Engineering Boundaries

Read the sections crossed by a change, not the whole file. Product intent is in
[Design Docs](../design-docs/README.md); code entry points and unresolved gaps are
in [Journey Coverage](journey-coverage.md). Unlabelled invariants are required;
implementation details, exact limits, and protocol variants belong to code/tests.

## Runtime Ownership

```text
Electron windows → shared Node server → Python daemon → one MFS store
                         ├─ native Agent sessions
                         ├─ MCP project operations
                         └─ account/model broker
```

| Owner | Authority |
|---|---|
| User filesystem | Source files, Wiki Pages, and native instruction files |
| Electron main | Window/capability identity, server-child lifetime, native save barriers, updates, recovery-key protection |
| Node server | Registered projects, authorized file operations, preparation, Settings, MCP operations, Agent adapters |
| Python/MFS | Completed text projections, revisions, chunking, embeddings, status, and retrieval through public APIs |
| Native Agent runtime | Sessions, conversation history, native capabilities and tool execution |
| Renderer | Window-local presentation, live buffers, scoped commands, and caches; no durable data authority |

Closing one window releases its work, not services used by peers. Only Node
binds folders into the daemon. Generation replacement waits for old owners to
retire; late callbacks cannot mutate replacement state. Cleanup attempts every
owner independently, even when one fails.

## Project Scope and Paths

- One registered folder is one search namespace. Shared storage is not a global
  Library. Search/reindex never aggregate projects when scope is absent.
- Keep filesystem spelling for I/O and display, including whitespace, case, and
  Unicode. Use comparison identity only for equality and subtree matching.
  Realpath-aware containment protects existing and creatable targets; lexical
  prefix checks alone do not establish symlink safety. Slow probes must yield.
- Requests retain their authorized folder across awaits. Supplied blank or stale
  session identity fails; it is never treated as omitted. Only absent identity
  permits an owning window's sole active turn to supply attribution, never an
  app-wide active turn. External clients select a registered project explicitly.
- Open prepares validation and its registry response before committing membership
  and window binding. A newer open, close, or retirement invalidates pending work.
  Directory absence never silently removes membership or favorites.
- Project creation stays beneath the default home or an authorized location.
  Entry and Agent startup never seed or rewrite user-owned instruction files.
  Introductory content seeds only a pristine default home; its durable latch
  preserves deliberate deletion/removal.
- Removing membership preserves source files and independently registered nested
  projects, including temporarily missing ones. Gate overlapping removal/open
  operations, retire background work, clean owned state, and remove membership
  last so interrupted cleanup remains recoverable.
- Workbench visibility can include generic files and excluded placeholders.
  That does not grant preparation, retrieval, or MCP access. Derived artifacts
  never become visible source results or writable targets.

## Source Transactions

HTTP, Agent, and MCP adapters share file/version authorities. Source capability
follows the [format matrix](../design-docs/design/writing-workspace.md#format-capability-matrix);
preview, content editing, and rename/delete are separate permissions.

- Read content/version from one bounded snapshot. Hash complete bytes, not mtime.
  Serialize in-process writes, stage, then recheck the expected version before
  publishing. The queue does not provide OS compare-and-swap against external writers.
- A live editor value is save authority before a dirty badge renders. Navigation,
  folder changes, and native context release cannot skip a fresh edit.
- Conflict preserves both dirty and disk text until explicit reload, overwrite,
  or merge. Never automatically retry without the base version. Merge remains a
  dirty draft against the newer version; competing decisions serialize.
- After publication, save waits for projection acceptance, not embeddings.
  Index failure is a save warning, not rollback. Identical saves retry projection
  maintenance. Empty/excluded/unreadable current text cannot expose an old result
  merely because deleting its index row failed.
- Preserve supported source conventions and untouched JSON lexemes/whitespace.
  Structured edits splice source ranges; replacements treat dollar sequences
  literally. Invalid UTF-8 is never rewritten lossily. Agent text writes reject
  unintended control bytes without consuming valid literal backslashes.
- Rename/move/delete validate before cancelling work, await native-handle release,
  mutate, retire old derived/index identity, then rediscover and notify. Generic
  Workbench mutations do not broaden Agent content permissions.
- Link rewrites plan against versions before rename and apply through the shared
  transaction owner. Rollback restores only bytes it still owns. Current cascade
  covers inline Markdown links/images and HTML anchor hrefs, not reference-style
  definitions or other HTML attributes. MCP file moves stay inside one project.

### Import Publication

File uploads use disk staging and no-clobber publication. GitHub import accepts
only the supported public HTTPS repository URL and a portable direct-child name;
Git runs without ambient config, credentials, hooks, submodules, or LFS downloads.
Inspection and cancellation happen before committing registration.

Publication and rollback track owned filesystem identities. Preserve concurrent
edits, replacements, and unrelated additions; never recursively delete an
ambiguously owned target. Register a successful acquisition before returning its
path. A later window-open failure keeps the copy registered. Directory publication
and exclusive-copy fallback are not atomically visible; tests prove specific
races, not protection against every adversarial syscall interleaving.

### Recovery Journal

The server encrypts bounded draft snapshots outside projects; Electron protects
the key with OS storage. The private child handoff cannot leak to daemon/Agent
children. No key means unavailable, never a plaintext fallback. Sign-out does
not delete local drafts or their key.

Snapshots retain source identity and base version, coalesce behind a bounded
delay, and serialize with reads, eviction, and discard. Two windows share one
entry per source; only changed text is journaled. Restore makes an unsaved draft
with the recorded base version, never a direct disk write. Save/discard removes
it. Retention, byte/count limits, and delayed or failed writes mean this is not
a guarantee of the latest text. The unaccepted storage decision and recovery
visibility/concurrency gaps remain recorded under J03.

## Preparation and Retrieval

StashBase owns preparation so previews and readable text work independently of
vector indexing. It sends complete text into MFS Internal namespaces; MFS alone
owns revisions, unchanged classification, chunking, and index status. Do not add
a second projection ledger or query MFS implementation tables.

- Completion is format-specific and current-source-bound: PDF needs its terminal
  marker; DOCX needs sanitized marked output with text; media needs valid
  structured transcript plus marked timestamped text. Empty completed OCR is a
  successful non-searchable result. Checkpoints and playback previews are not completion.
- One process scheduler owns capacity and prioritizes explicit interaction, open
  projects, then background work. Cooperative yield preserves task identity while
  releasing capacity. User Cancel is durable until Reprocess; shutdown/mutation
  interruption remains recoverable. Cancel the full native process tree and await
  handle release. Optional helpers must not block browsing or steal native focus.
- A resumed media attempt keeps its captured provider/model/language and urgency,
  rechecks availability, and respects cancellation. Reprocess validates dependencies
  before resetting output. Settings changes govern future attempts.
- Reconcile is folder-explicit and rediscovers lost in-memory work. Apply common
  hidden/dependency exclusions before traversal and mutation-triggered scheduling.
  Queuing invalidates stale final output; source removal retires all owned artifacts.
- The longest registered folder owns a source namespace. Nested binding replay
  retires ancestor projections in order with admission. Daemon readiness waits
  for current config/bindings; reset/removal races retry the authoritative operation
  once from bind instead of recording expected retirement as source failure.
- Existing namespaces remain usable for exact retrieval without an embedding key.
  Admission does not await semantic builds. Configuration changes supersede old
  credentials/generations; store deletion failure must propagate.
- UI **By keyword / By meaning** maps to internal grep/hybrid. Active HTTP/MCP
  `keyword`/`semantic` values remain protocol vocabulary. Omitted mode is resolved
  from key configuration on each lookup; explicit mode and provider failures never
  silently fall back. Key presence is configuration, not health or completion.
- Retrieval and prepared reads share current-source eligibility and complete-output
  checks. Apply namespace/path/type narrowing before bounded results; report
  truncation and partial reads. Remap all evidence to visible sources. A legacy
  derived-path request must resolve through its live source before authorization.
- Resource ceilings must stay finite and aligned across Node/Python. No-op reconcile
  spends no embeddings but still transfers text for MFS revision classification.
  A rename is not a zero-reembedding guarantee. Ranking changes need J05 evaluation.

### Optional Local Components

One PDF/OCR installation owner shares demand and waiters. Cost/status reads never
start downloads. Waiting conversions yield their lane. A process makes one
automatic demand attempt; failure has no timer retry. A durable demand latch
permits one next-launch attempt; Settings Retry starts one shared attempt.
Cancellation removes source demand; explicit/startup downloads have component
ownership. Shutdown retains unfinished demand.

Only the app's embedded version/platform/asset/size/hash manifest authorizes
bytes. Verify before confined, bounded extraction and atomic versioned publication;
validate links and never execute partial staging. Installed versions work offline.
Signing and release publication belong to [Release Runbook](release-pipeline.md).

## Agent Sessions and Permissions

- Boot performs bounded asynchronous discovery/auth/MCP preparation, never install
  or login. Explicit installation runs only the selected runtime's official
  installer. Preparation/reset/shutdown share one cancellable flight per runtime.
  Stage/code/retryability are structured; the renderer never parses error prose.
- User-installed CLIs keep their native account/history ownership. System installs
  are never uninstalled by StashBase. Legacy private-runtime cleanup is bounded
  to AppData and remains subject to the previous-version data policy.
- Installer completion means successful native exit plus verified discoverable
  output. Own temporary scripts and descendant cancellation; neither cleanup nor
  shell wrappers may mask failure. Do not redirect official installs into private
  paths or destructively rewrite user PATH. Platform details live beside the installer.
- Each OpenQuill chat owns an authenticated loopback OpenCode process; each Codex
  chat owns its app-server/thread. History readers have separate ownership.
  Process death settles pending RPCs/turns, and generation guards reject late
  messages. An ambiguous timed-out start retires its generation before retry.
  Claude replacement waits for native iterator/query cleanup after verifying scope.
- Unstarted means no session/transcript/turn; blank also means no pending user work.
  Blank chats may follow the window and be reused; user work pins scope. Runtime
  adoption preserves draft/source paths, not transient upload bytes. Mode changes
  never remount ongoing work merely to change presentation.
- Started sessions survive window folder switches. Member removal retires only
  bound sessions, reports a structured scope-removed event before closure, preserves
  transcripts, and rejects queued/late work. Expected retirement never reconnects.
- Native history is authoritative. Scope overrides persist before emitting rebind;
  only an attributed live unbound chat may move after explicit project creation.
  Persistence failure returns the registered project without rebinding. OpenQuill's
  incomplete native rebind remains a J11 gap.
- Instructions are scoped Settings guidance resolved at native mount and composed
  with internal routing policy. They are not permissions, skill contents, or
  project-file edits. Empty reset restores the packaged default; saves do not
  mutate a running native prompt. Brainstorming needs no sources/wiki/index.
- Context/attachments are explicit. Validate source identity before send; stale
  context blocks it. The queue captures prompt, context, skill, and id, and Retry
  uses that exact submission. An edited settled prompt starts a new turn rather
  than truncating history. Historical metadata cannot restore attachment bytes.
- Models/effort/modes follow runtime capabilities. Catalogs seed drafts, not live
  identity. No catalog-order default or global CLI rewrite; active turns freeze
  changes. Skills use native invocation, not concatenated skill-file contents.
- Pending approvals require the exact request id; abort/disposal denies them.
  Read/orientation/reindex may use the low-risk path. Edit policy grants only its
  bounded writes; move/delete/commands/network/broader access require their own
  authority. `create_project` needs an explicit request or visible approval.
- Codex modes use on-request approval with mode-specific sandbox/review policy;
  Claude maps native modes; OpenQuill always asks. Unbound OpenQuill disables
  native filesystem/command tools; bound native tools cannot escape their cwd.
- Turn failure settles once without destroying a live session. Advisory notices
  never become terminal errors. Recover by structured kind: authentication needs
  process/session refresh, credits/restrictions need account recovery, transient
  failures may resend. Raw socket loss has bounded retry then manual recovery.

## Credentials and External Access

Node is the sole atomic app-config writer. Strict writes fail on malformed or
unwritable current state rather than saving fallback defaults; preserve unrelated
current domains. Never repair filesystem ownership/ACLs automatically. Historical
data migration is not required by [maintenance policy](../MAINTENANCE.md#previous-version-data-policy).

- BYOK keys enter through Settings, never environment or projects. Renderer input
  is transient; account tokens remain Node-only. Account state does not configure
  embeddings. Reconfigure only the dependent runtime; a runtime failure does not
  undo a successfully persisted key.
- Account OAuth uses Node-owned PKCE and window-bound opaque flows. The fixed
  app-return deep link carries no code/token/flow id; authenticated native
  acknowledgement proves focus handoff. Cancelled polling is not OAuth revocation.
  Refresh is single-flight and can update only the session it began with.
- Avatar proxying is restricted to validated HTTPS provider hosts with bounded
  redirects/time/bytes/type; it is not a general fetch endpoint.
- OpenQuill receives a random session-local model broker credential, not account
  secrets. Model calls require an active submitted turn, retain its id/idempotency
  across the one auth-refresh retry, and cannot expose account tokens in history.
  Hosted quota/accounting stays external; the desktop exposes only bounded usage.
  Child environment and AppData HOME/config isolate ambient secrets and user config.
- Built-in HTTP and external MCP share Project Operations. Streamable HTTP checks
  the current Settings token on every POST; rotation invalidates old tokens.
  Loopback is default; Docker opt-in exposes only the separate MCP listener.
  Browser Origins/CORS stay closed. Listener transitions serialize and roll back
  active exposure if persistence fails. Stdio is scoped to its spawning client.
- MCP reads are bounded; line windows omit a version so partial content cannot
  authorize a whole-file overwrite. Generic/derived/unsupported entries never
  bypass source admission. Native coding-Agent tools have separate runtime permissions.
- Readiness alone writes the built-in CLIs' MCP config; OpenQuill injects config
  per process. External clients copy their setup manually. No second client-config
  or credentials store belongs in StashBase.

## Renderer Boundaries

`app` binds adapters and coordinates features through public interfaces.
Features do not import siblings: domain is pure; application owns Ports/runtimes;
infrastructure maps wire/errors; hooks/UI adapt and present. Shared code is a
leaf, platform owns host mechanisms, and the installed kit reaches no product
policy. `test-support.ts` is test-only. Repository contracts/wire schemas cross
registered host boundaries; renderer shared types are a different layer.

- Capture scope and generation before await; reject stale completion even for
  same-folder subtree mutation. Separate request lanes cannot cancel unrelated work.
  Stores, query caches, timers, subscriptions, workers, and URLs have explicit
  owners and disposal. One window has one query client, not durable authority.
- Main's one-shot folder claim and server binding decide entry, not saved layout.
  One startup window claims restoration. Native session persistence serializes
  changed records against each window's baseline, preserving peer changes;
  failed writes retain the last valid file and do not advance the baseline.
- Tabs stay unique across asynchronous opens. First edit keeps a preview; only
  kept tabs persist. History advances after open succeeds. Hidden panes are inert;
  mode/visibility changes preserve drafts, transcripts, focus, and session identity.
- Refresh keeps usable content. Clean editors may adopt newer source; dirty ones
  retain drafts for conflict. Optimistic metadata rollback uses the last confirmed
  value and ignores superseded failures. Network failure is not scope retirement.
- Viewers declare services/capabilities in one registry. Active-owner claims govern
  Find/outline/save; old cleanup cannot clear new claims. Heavy rendering is
  bounded and version-keyed. Milkdown retention is a bounded MRU, and dirty live
  edits cannot be replaced by late source acknowledgements.
- Milkdown serialization preserves frontmatter outside the body. Find/outline use
  the live document without mutating editor DOM during change callbacks. The sole
  double-cast exemption is its Find controller's structural DOM corpus and guarded
  CSS Highlight probe; other exceptions need their code-owned rationale.
- Surface recovery remounts the smallest boundary. Shell remount loses live buffers
  and can recover only sealed journal snapshots. HTTP loss must not reload the app.
  Raw failures are mapped to feature-owned messages and recovery kinds.

### Document and Window Trust

Sandboxed, context-isolated windows have no Node integration and load the bundled
application origin (explicit Vite development is separate). Main authorizes live
main-frame origin and capability for each parsed IPC call and stamps HTTP/socket
identity itself. Canonical API/Agent paths only; asset requests carry no window
authority and retain server path checks. CSP/root containment, navigation/popup/
webview denial, and narrow preload methods cannot be weakened by document content.
Only sanitized clipboard write is granted to the application origin; paste needs
no background clipboard-read permission.

Markdown renders schema nodes; DOCX is sanitized inside its worker with the shared
policy. Local HTML's scripts run in an opaque sandbox without same-origin/preload,
form, popup, or navigation authority. Frame messages validate source, shape, and
user activation for external links (server-produced DOCX has its narrow exception).
Relative links resolve inside the source's folder. Executable HTML/remote resources
remain a documented trust gap, not permission to expand the boundary.

### Styling and Tooling

Executable configurations own exact layering, lint, coverage, size, duplication,
and unused-code rules. Do not reproduce their inventories here. Primitive/story
reachability complements unused-code analysis, which counts test-only callers.

One token/geometry/motion system serves app and catalog through shared providers.
Bundled kit code never loads registry/CDN assets at runtime. Overrideable CSS
belongs in its layer; scoped themes resolve their own tokens. Reduced motion must
settle both JS and CSS lifetimes, including transition-end waiters. Structural
shape, DOM-test, swallowed-error, and third-party token exceptions remain locally
justified and bounded. Stories/axe do not prove painted contrast or composition.

## Native Lifecycle and Updates

Main owns launch identity, save barriers, retirement tombstones, and shutdown.
Readiness must match the spawned instance, not merely a listener or PID.
Single-instance and startup arbitration prevent duplicate initial windows.
Packaged launches own their server; bounded POSIX orphan reclaim verifies sibling
identity and a dead parent before killing. Foreign/live-parented listeners remain untouched.

- Close asks the owning loaded renderer and stays open on failure/timeout. Explicit
  quit retains intent through asynchronous saves and revokes it on refusal.
  Windows/Linux quit after the last window; macOS activation may create another.
- Update installation requires every loaded window's acknowledgement. Main locks
  interaction and new-window creation throughout save/install preparation so
  later edits cannot invalidate approval. Failure restores prior enabled state,
  revokes exactly its approvals, and leaves the download retryable.
- Renderer requests never choose feed, path, or phase. Automatic checks do not
  authorize downloads/install. Production exposes no development simulator.
- App quit authenticates to the owned server and awaits independent cleanup;
  timeout signals are fallback. Window close cannot terminate shared services.
  Native reload has no bypass around saving; current recovery remounts React.

## Bug Report and Gallery

### Bug Report

Main derives source/review identity from IPC senders. Review windows are independent
of their source and retain narrow capabilities. Collection is allowlisted and
bounded: only the authorized app-window screenshot, diagnostics, and sanitized
log tail. Never collect project files, transcripts, credentials, or raw config.
Unavailable/suspicious resources fail separately; raw resources never cross the
review interface or enter logs.

Preview shows the exact approval-eligible artifact and never changes inclusion.
Final description save precedes approval; unsaved text survives a failed attempt.
Approval freezes selected resources, and handoff atomically claims that snapshot.
Reopening discards approval. Rescan final formatted text before atomic output;
never recollect after approval. One approval has idempotent allocation/copy and
retry, while a fresh approval gets a new destination. Claimed handoff survives
window close. Downloads are user-owned; temporary output is session-owned.
Preparing, downloading, and opening GitHub remain explicit separate actions;
artifact bytes, paths, logs, and internal identities never enter a GitHub URL.

### Gallery

Node proxies a validated whole index and restricted screenshots; the renderer
never contacts arbitrary catalog hosts. Normalize URLs before exact host/path
checks, refuse redirects, validate before caching, and fall back to the bundled
snapshot on unsupported/unreachable publications. Index reads carry no project
or composer content. Both entrances share one copy latch. Acquisition uses the
ordinary import transaction; later window failure preserves the registered copy.

## Validation

Use [Journey Coverage](journey-coverage.md) for concrete front/back-end entry points
and existing evidence. For a cross-cutting change, start with the owners below.
Run focused checks while editing and the gates required by [AGENTS.md](../AGENTS.md)
before committing. Release-specific evidence stays in the [Release Runbook](release-pipeline.md).

| Boundary | Primary owners | Focused commands |
|---|---|---|
| Window/process lifetime, trust, updates | `electron/main.cjs`, `electron/window/lifecycle.ts`, `electron/renderer/requests.cjs`, `electron/update-window-barrier.cjs` | `pnpm test:electron`, `pnpm test:electron:smoke`, `pnpm test:updates` |
| Project paths, source transactions, import/recovery | `server/folder.ts`, `server/filesystem-path.ts`, `server/text-file-transaction.ts`, `server/project-file-mutations.ts` | `pnpm test:project-files` |
| Preparation, daemon, retrieval | `server/conversion-scheduler.ts`, `server/sync.ts`, `server/mfs-daemon.ts`, `python/stashbase_daemon.py` | `pnpm test:conversion-scheduler`, `pnpm test:retrieval`, `pnpm test:python` |
| Agent processes and protocol | `server/agent-contract.ts`, `server/agent-runtime-installer.ts`, `server/agent-adapters.ts` | `pnpm test:agent`, `pnpm test:agent:native`, `pnpm test:opencode:native`, `pnpm test:protocols` |
| Settings/account/MCP | `server/app-config.ts`, `server/hosted-account.ts`, `server/mcp-http-settings.ts`, `server/project-operations/index.ts` | `pnpm test:config`, `pnpm test:mcp`, `pnpm test:project-files` |
| Renderer ownership and mechanics | `renderer/src/app/dependencies.ts`, `renderer/renderer-architecture.json`, `scripts/renderer/check-web.mjs` | Focused `pnpm test:renderer <path>`; Story checks `pnpm test:renderer:a11y`; complete `pnpm check:web`; wire changes add `pnpm test:protocols` |
| Bug report / Gallery | `electron/bug-report-service.cjs`, `electron/bug-report-handoff.cjs`, `server/routes/gallery.ts` | `pnpm test:electron`, `pnpm test:electron:smoke`, `pnpm test:project-files`, focused renderer tests |

Source tests, controlled native smokes, model quality, and packaged delivery
prove different things. Story accessibility checks execute each story's
interaction once at default/light appearance; happy-dom cannot establish painted
contrast or layout. Theme/density review remains a browser/runtime concern.
Use the [test selection policy](../AGENTS.md#test-selection) and
[command guide](../CONTRIBUTING.md#testing) to avoid duplicate validation.

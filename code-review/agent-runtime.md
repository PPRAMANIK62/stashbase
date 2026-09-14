# Agent Runtime

> Review contract for supported CLI discovery, managed installation, MCP
> preparation, native session ownership, history, and protocol normalization.

## Included OpenQuill

- OpenQuill is the included `stashbase` adapter and the runtime a new chat
  opens on whenever it is ready. It uses exact-version
  `opencode-ai@1.18.19` and `@opencode-ai/sdk@1.18.19` dependencies; packaging
  copies the dependency's platform-specific postinstall target to a stable
  resource outside asar rather than relying on dependency collection to retain
  a generated file. Resolution prefers that explicit package-owned binary,
  retains package-owned development fallbacks, and never falls back to PATH.
  OpenCode auto-update and sharing are disabled, provider configuration is
  process-injected, and its
  XDG state plus child HOME stay under AppData so user-global OpenCode/Claude
  config and skills cannot enter the bundled runtime implicitly. Its child
  environment is an allowlist of launch, locale, temporary-directory, and TLS
  plumbing; ambient provider keys, proxy credentials, user OpenCode settings,
  and Node/Electron injection flags do not cross the process boundary.
- macOS signs the bundled OpenCode/Bun executable with its own entitlements.
  `allow-unsigned-executable-memory` is required for its generated executable
  pages under Hardened Runtime and must not leak to the Electron app or ordinary
  helpers. The packaged smoke must complete a fake-gateway model turn with the
  final signed binary and observe it still running; `--version` alone is not a
  runtime proof.
- Readiness is a cheap packaged-binary and StashBase-account check. It never
  installs a runtime or asks for a model key. Sign-out ends OpenQuill
  sessions and processes before clearing the Node-owned account session.
- Each live panel session owns a loopback-only OpenCode server with random
  Basic authentication. Its MCP child receives the exact window id and a
  random live-session attribution id. History reads use a separate runtime
  and remain available while signed out because native sessions are local;
  app shutdown closes every process and the model broker.
- OpenCode receives only a random loopback model credential. The Node broker
  issues that credential per live Agent session, requires an active
  user-submitted turn, authenticates the account, retries one 401 after token
  refresh, preserves one idempotency key, and sends the same validated UUID in
  `x-stashbase-agent-turn-id` for every model call in that prompt turn before
  streaming to the hosted
  OpenAI-compatible contract at
  `POST /v1/agent/chat/completions`. The account usage contract is
  `GET /v1/agent/usage` and reports remaining percentage, token totals, and the
  fixed seven-day window timestamps. Neither endpoint exposes account tokens,
  model pricing, or monetary balances to the renderer or OpenCode state.
- The hosted service owns DeepSeek routing, picodollar cost accounting,
  fixed seven-day windows, and OpenQuill credit enforcement. Search by meaning
  uses the user's separate provider key and has no hosted search credits. The
  hosted Agent service pre-reserves before every call and
  settles provider usage exactly once without making an account balance
  negative. The first call of
  a submitted prompt pins policy and model versions for that turn; all later
  model calls caused by the same prompt reuse its turn identity and $0.20
  ceiling. It does not own Agent processes, sessions, tools, permission
  decisions, or files. Credit exhaustion becomes the structured
  `allowance-exhausted` turn failure; the per-turn spending ceiling remains a
  distinct `quota` failure. Application-authored messages say OpenQuill free
  credits, while legacy wire codes and older runtime messages retain their
  classification. Current renderer recovery limits are recorded in
  [Agent Panel](agent-panel.md#known-gaps).
  Active hosted-account restrictions block Agent reservations atomically.
  Reset or expiry closes a window to new calls immediately; reservations
  already in flight still settle against that original window, while a later
  call must use a fresh prompt-turn identity.
- The desktop targets the stable `stashbase-agent-default` profile alias and
  does not expose model selection in the first release. The hosted service
  resolves the alias through an immutable, versioned model profile registered
  to a code-owned provider Adapter; arbitrary provider URLs are never accepted.
  File Diffs, cumulative text/reasoning, tool states, permissions, titles,
  history, abort, and errors normalize through the shared protocol. OpenCode
  tool names are normalized once at this Adapter boundary.
- Unbound sessions disable OpenCode's native read/write/edit/search/command
  tools and reach files only through the membership-checked StashBase MCP
  operations. Folder sessions may use native tools inside their exact cwd;
  edits, commands, web access, and doom-loop recovery ask, while external
  directory access is denied.

## Discovery and Preparation

- App boot and folder navigation perform only cheap discovery, a bounded
  side-effect-free Codex authentication check, and idempotent MCP repair for
  already installed runtimes. They never install an Agent, start login, or run
  a login-shell probe.
- New Chat opens readiness for the selected Agent but does not itself authorize
  a download. Discovery prefers a supported system executable (including the
  official user-level locations such as `~/.local/bin` and the official
  Windows standalone bin), then a legacy managed executable under AppData.
  If neither exists, the Agent gate waits for **Install and continue** (or
  the explicit Settings install action) before installing only that Agent's
  official runtime. Opening, switching, or resuming a tab never installs
  another runtime as a side effect.
- **Install and continue** runs the provider's official user-level installer —
  the same command the install hint prints — so the installed CLI is usable
  from the user's own terminal afterwards. The official installer owns its
  standard install layout and the user's shell-profile `PATH` entry;
  StashBase itself never edits shell profiles, never pins the install into a
  private directory, and strips any stale private pinning inherited from
  older versions before the installer runs. Installs continue using the
  provider's normal account and history home, so terminal and StashBase
  sessions share one login and one history. Legacy private installs under
  AppData (from older StashBase versions) remain discovered and usable; they
  never modified `PATH`.
- Codex readiness checks the selected executable with `codex login status`.
  A signed-out runtime is installed but not ready: it stops at the structured
  authentication stage before MCP configuration. The explicit sign-in action
  runs that exact executable's `codex login` browser flow with its normal
  account home, never installs another copy, and never passes credentials
  through StashBase. Success rechecks status and resumes MCP preparation;
  cancellation, timeout, and native exit remain retryable authentication
  failures. Claude continues to report authentication through its native SDK
  connection.
- Settings offers Uninstall only for a legacy StashBase-managed runtime under
  AppData, never for a system executable — official user-level installs are
  the user's own and are never removed by StashBase. Uninstall stops that
  agent's sessions, resets preparation state, and removes only the private
  install under AppData (the removal path-guards to that root). Uninstall is
  disk reclamation, not deactivation: the next explicit New Chat re-runs
  readiness.
- Both installs fetch and run the provider's official installer script. On
  Windows, installation prefers PowerShell 7 from the inherited PATH or its
  standard Program Files location, then falls back to Windows PowerShell; a
  known legacy-shell architecture failure names the PowerShell 7 recovery
  instead of becoming a generic executable-check error. The downloaded
  PowerShell installer runs from one temporary `.ps1` file rather than as a
  statement stream or nested script, so a failed download, extraction, or
  verification cannot be followed by a successful stdin statement or outer
  script that masks the failure with exit code zero. A bootstrap inserted
  after the official parameter declaration strips redirecting environment
  (stale private pinning, the Electron node marker) and pins non-interactive
  mode — it never assigns install paths. The declaration may be Codex's
  `[CmdletBinding()]` header or Claude's bare `param` block; `param` must
  remain the script's first statement, so the bootstrap never precedes it.
  The Windows PowerShell child remains
  attached so its close event cannot report success before the script host
  completes; Windows cancellation still terminates the full tree through
  `taskkill /T`. Temporary script cleanup never replaces that result.
  Download status warns that the progress-silent package may take several
  minutes, while any eventual installer stderr remains the primary failure.
  Claude's official script checksum-verifies the release and runs the
  binary's own `claude install`, which sets up the user-level launcher; its
  POSIX form requires bash, so the Claude installer shell resolves to
  `/bin/bash` where Codex uses `/bin/sh`. On Windows, `claude.exe install`
  leaves its bin dir off the user Path, so a successful Claude install
  repairs the per-user Path additively: the raw
  `%USERPROFILE%\.local\bin` entry is appended only when no existing entry
  expands to that directory, the value is written back as REG_EXPAND_SZ so
  other entries keep their variable forms, the change is broadcast so new
  shells see it, and nothing is ever removed, reordered, or written through
  truncating `setx`. A failed repair stays a note — the install itself
  remains successful and StashBase discovery is unaffected. POSIX PATH
  remains provider-owned.
  System discovery checks the official user-level locations directly
  (`~/.local/bin` on every platform, the official Windows standalone bin
  under LocalAppData), so both a StashBase-run install and one completed
  outside StashBase are visible even while the already-running desktop
  process still has the previous user PATH. Legacy managed discovery accepts
  the private bin, the installer's visible bin junction, its official
  standalone `current` package layout, and a versioned release executable.
  A successful installer exit without a discoverable executable in the
  official locations is reported as missing output, never verified through a
  fabricated path that can collapse into ENOENT; failed executable checks
  retain bounded timeout, exit-code, and stderr diagnostics. Shutdown cancels
  preparation.
- Readiness configures the matching CLI's StashBase MCP entry through
  `ensureAgentMcp`, the only writer of the Agent Panel runtimes' own config files.
  Native attach repeats that idempotent write immediately before process
  start. There is no user-facing connect/disconnect for Agent Panel runtimes; MCP
  is part of readiness, and Settings surfaces a repair action only on
  failure.
- Preparation is one staged Interface: discover, install only when missing,
  verify provider authentication where supported, then configure MCP. Its
  failure contract names `stage`, `code`, a bounded message, retryability, and
  an optional manual recovery. Renderer code must not classify failures by
  parsing messages. Installation failure may expose the provider install
  command; authentication offers the provider-owned in-app browser flow; MCP
  failure may expose the read-only manual MCP setup, never an install command.
- Retry calls the same preparation Interface. Fresh discovery skips a completed
  installation, authentication recovery reuses the selected executable, and an
  MCP retry rewrites only the idempotent MCP configuration; no parallel repair
  state machine exists.
- Explicit recheck is narrower than Retry: it repeats fresh executable
  discovery (including the deliberate shell probe) and configures MCP only when
  a runtime now exists. A missing runtime preserves the prior failure and never
  starts another download.
- Development failure injection is one mutually exclusive, in-memory
  `nextFailure` value. It is consumed only when explicit readiness reaches that
  stage and immediately resets to normal; background startup repair never
  consumes it, and an installation injection stays pending when an existing
  runtime skips installation. The authentication injection arms only the Codex
  sign-in gate — never Claude, which has no login surface — and a completed
  login is verified for real rather than consuming it. Settings presents these
  controls inside a visually distinct development-only surface; production
  omits the surface. Availability follows the general development-runtime
  marker and does not depend on whether the renderer is served through Vite.
- Development turn failure injection is a separate one-shot `nextTurnFailure`
  value consumed by the next prompt of a live Claude or Codex session.
  The adapter plays a scripted failure through its normal event path — a
  turn-scoped error for rate-limit, quota, auth-expired, and network shapes, or
  a session-ending exit for crash — and the prompt never reaches the native
  runtime. Script messages are provider-shaped but always prefixed
  `Simulated failure:` so a developer cannot mistake one for a live error.
  Each non-fatal script classifies to its own turn-failure kind through the
  live classifier, so an injected failure exercises exactly the recovery
  presentation a real one gets; a pinning test fails if either side drifts.
- A discovery, installation, authentication, or MCP failure is visible and
  retryable but never blocks the workspace or silently substitutes another
  Agent.

## Session Scope and Lifetime

Agent sockets use the exact `/ws/agent` endpoint, with runtime selection in the
query. Retired aliases, suffixes, and alternate case spellings are rejected
before upgrade. Explicit Vite development owns only the root HMR socket;
unrecognized Agent paths cannot fall through to it. The proxy never installs
a second automatic upgrade listener. Electron's window identity
checks are owned by [Architecture](architecture.md#cross-process-contracts).

An Agent session binds to `{ kind: 'unbound' }` or an authorized member folder.
Missing scope uses the window's current folder or an unbound context when none is active;
it is not a third scope.

- An unbound session retains the reserved folder-home cwd for existing
  history, but cannot retrieve project files before binding. Its Runtime Adapter resolves the unbound scope's exact
  user-visible Agent Instructions — the saved unbound customization, or
  the packaged unbound default — before composing the internal routing policy.
- A folder session uses that folder's cwd. Its Runtime Adapter injects that
  exact member's resolved Agent Instructions plus the internal routing policy.
  Runtime startup never creates `AGENTS.md`, `CLAUDE.md`, or another source
  file; existing runtime-native files remain visible, user-owned inputs under
  that runtime's native rules.
- `assets/agent-instructions/default.md` (folder Chats) and `unbound.md`
  (unbound Chats) are the two packaged defaults. The project default supports
  empty-project discussion, requested drafting and revision, and source-backed
  answers when relevant; wiki creation and maintenance require a wiki task.
  It does not gate discussion on references or indexing. Prompt wording does
  not enforce permissions, and store/Adapter tests do not prove model adherence.
  The Agent Instructions Interface resolves the session scope's default or its saved customization;
  the editor and HTTP Adapter expose only that exact text. At native session
  startup, each Runtime Adapter composes it with the product-owned policy from
  `server/agent-runtime-instructions.ts`. That policy prefers StashBase MCP for
  project discovery and prepared PDF, DOCX, audio, or video reads. It directs
  search to use only the bound project and requires an unbound Chat to open
  or create a project before file access; enforcement belongs to [MCP Access](mcp-access.md). It avoids a
  redundant parser unless original-source analysis was explicitly requested or
  prepared text is unavailable. Codex receives the composition as
  `developerInstructions`, Claude as the native preset append, and OpenQuill
  as its OpenCode Agent prompt. MCP advertises tools without a second top-level
  instruction prompt. No Adapter mutates a started native session's prompt in
  place or grows a live setter, so a saved edit reaches the next session that
  mounts under that scope rather than the conversation already running. They
  are guidance, not authorization or a security boundary.
- Sessions own project attribution, not retrieval configuration. Project
  Operations resolves an omitted mode on each lookup: grep without an
  embedding key, hybrid with one. Explicit modes are honored and provider
  failures are never silently downgraded. No runtime stores a second switch
  or handles a retrieval-policy event; lookup strategy does not own indexing.
- Window folder switching does not tear down or rebind started sessions.
- Codex history reads, renames, and deletes validate native thread ownership
  against the requested project before mutation. A persisted rebind override
  is checked first and authorizes only its destination project. Rename returns
  native thread metadata, never a fabricated row from a limited history list.
- Folder removal ends every session bound to that member across windows but
  does not end unbound sessions. Before closing each affected transport, the
  Adapter emits the structured `scope-removed` exit with the retired member
  path; renderer behavior must not depend on membership refresh timing or a
  raw close. Window close ends that window's sessions; app quit ends all
  sessions through the cleanup ladder.
  The removal owner iterates the registered Adapters; OpenQuill participates
  in the same structured retirement and sends it before closing its socket.
- `create_project` may migrate only the attributed live unbound session.
  Persist the session-to-folder override before emitting the scope change so
  history never lists the session in both scopes. Persistence errors propagate
  to the creation owner, which returns the registered project with
  `rebound: false` and leaves the live binding intact. Preserve native session
  identity while moving subsequent execution to the project cwd: Codex keeps
  its thread and changes the next turn cwd; Claude lets the creating turn
  finish, then resumes the same native session from the project cwd before
  accepting the next prompt.

## Native Process Ownership

- Each live OpenQuill chat owns one authenticated OpenCode server. The
  per-session process boundary keeps MCP attribution exact when turns run
  concurrently. All servers may share OpenCode's native history store, while
  their injected config and credentials remain process-local.
- One live Codex chat owns one app-server process and one thread. History
  clients have separate process ownership and may share only their RPC
  vocabulary and a bounded idle cache.
- Every process exit/dispose rejects pending RPC work. Closed peers discard
  later inbound messages. A generation token prevents events from a retired
  process from settling or clearing a replacement generation.
- An unexpected per-panel OpenCode exit is a terminal session event. The
  runtime reports it to the owning panel, which emits one error and one exit,
  ends turn attribution, and closes the socket; native death must never leave
  the renderer in a permanent working state. Intentional panel or app teardown
  detaches that listener before terminating the child.
- A timed-out Codex `turn/start` has an ambiguous native outcome. Retire the
  generation before reconnecting; a later prompt uses a fresh generation.
- Claude session-id acquisition serializes by id after verifying the requested
  session belongs to the requesting scope. A replacement waits for iterator and
  query cleanup, not merely an interrupt acknowledgement.
- History remains native-runtime truth. StashBase may supplement only missing
  Codex desktop tool calls from the matching local rollout and may persist only
  the scope override needed for project migration.

## Protocol Boundary

The common Agent contract normalizes lifecycle, turns, interruption,
transcript events, approvals, history actions, capabilities, skills, models,
and effort. Renderer code selects by adapter metadata and does not branch on
assumed CLI versions.

- Model catalogs and effort levels come from the native runtime, in the
  runtime's own order. Where the runtime declares them, a catalog entry
  carries `isDefault` and `defaultEffort` (Codex's `isDefault` and
  `defaultReasoningEffort`), and an entry the runtime hides from its own
  picker is dropped. `Default` means no override and never rewrites global
  CLI configuration; the composer names the declared default in its place,
  and a runtime that declares none keeps the `Default` label until its native
  thread reports the actual model. Catalog metadata is never presented as
  live session identity.
- A catalog is a property of the runtime, not of a session.
  `server/agent-model-catalog.ts` keeps each native runtime's last-read
  catalog and the model it last ran with nothing chosen in
  `~/.stashbase/config.json`, and
  the runtime listing hands that memory to new chats as `catalog`. Codex's
  catalog is read at the runtime level from a bare app-server (`initialize`,
  `model/list`, exit, in the home directory) the first time the listing finds
  nothing remembered; a failed read is not retried for five minutes, so a
  runtime that cannot answer never slows the listing twice in a row. Claude's
  is read the same way from a bare SDK handshake (`initializationResult`, then
  close, before any turn, so nothing is spent and no session is written). The
  handshake names no default, because Claude keeps the chosen model and effort
  in its own user settings, so `server/claude-model-catalog.ts` reads `model`
  and `effortLevel` from the same `~/.claude/settings.json` the CLI reads (honoring
  `CLAUDE_CONFIG_DIR`): the configured model is the default when the catalog
  lists it, else the catalog's own `default` entry, and the persisted effort
  is the default effort of every model that can run at it, and the default is
  flagged in the catalog the way Codex flags its own. A Claude session
  publishes that same reading, so the memory describes Claude alike whichever
  path wrote it; a memory that names no default (one an older build's session
  left) is completed by one runtime-level read. Project-level settings are not
  consulted at the runtime level; a session reports the model it actually
  runs on its first turn.
- Permission modes are the product's four promises, and a runtime's `modes`
  capability lists the ones it can honor; each Adapter owns how. Claude maps
  them one to one onto its native `permissionMode`. Codex
  (`server/codex-approval.ts`) keeps every mode on `on-request` approvals:
  Plan is a read-only sandbox, Edit is a StashBase-side pass for file changes
  inside the folder, and Auto hands review to the app-server's `auto_review`
  reviewer. OpenQuill lists none and always asks.
- Codex applies an explicit idle model change to the next turn of the existing
  thread. The Adapter ignores model changes while a turn is active; returning
  to `Default` omits the next turn's model override.
- Attachments are explicit; the current source is never implicit context.
- Permission callbacks normalize into one renderer approval flow. Access policy
  remains outside transport/process modules.
  Claude's callback bypass is an explicit allowlist of local reads, discovery,
  and StashBase reindexing. Editing, moving, execution, and unknown tools wait
  for a user reply; abort or disposal denies a pending request. Native mode
  decisions remain owned by the SDK. Its one-time prepared-read hint uses the
  shared current-output check and never redirects toward stale text.
- Runtime errors settle only the matching active turn once. Retry-in-progress
  signals do not become permanent failures; repeated or late terminal events
  are ignored.
- Expected scope retirement is a structured terminal event, distinct from
  normal exit, runtime error, and unclassified transport closure. Both native
  Adapters send it before disposal; the renderer uses its reason and folder
  fields directly and never classifies close timing or message prose.
- Turn interruption is idempotent at the Adapter boundary. Codex currently
  exposes its already-idle interrupt race only through the stable
  `no active turn to interrupt` invalid-request message, without structured
  error data; the Adapter recognizes that compatibility case, settles only the
  matching local turn as non-error, and lets the ordinary turn-id guard ignore
  a later terminal notification. Other interrupt failures remain visible.
- Native advisory notifications normalize to the shared non-fatal `notice`
  event, never `error`. Codex initialization opts out of the legacy
  `guardianWarning` prose summary and consumes the structured automatic-review
  completion instead: `approved` is routine and silent, while denied,
  interrupted, timed-out, or unknown outcomes preserve their rationale as a
  notice. An older runtime that ignores the opt-out continues through the
  legacy `guardianWarning` fallback. Ordinary `warning` and `configWarning`
  messages, including structured configuration summary/details, remain
  visible without settling a turn or changing session readiness. The Adapter
  assigns this classification from native event structure; the renderer never
  parses provider prose to recover severity.
- A turn-scoped runtime error carries a structured failure kind. The kinds are
  rate-limit, quota, included-allowance exhaustion, hosted access restriction,
  auth-expired, and network, and an unmatched message stays a plain error. The
  shared classifier assigns the kind once, in the adapters, from native event
  structure. A turn failure never gates the panel and never ends the session,
  so the session that reported one is still the one a retry runs on.
- The kind is what a recovery has to be selected from. Rate, network, and
  quota failures clear on the provider side, so resending the failed prompt on
  the live session is a truthful action for them. The other three are not.
  Credentials are read at process start and an external login is invisible to
  the running process until it is replaced, so an expired sign-in is recovered
  by replacing the session's native process (Codex through its in-app browser
  sign-in with the session id stashed so the reconnect resumes the same native
  thread, Claude by naming its terminal `/login` steps behind an in-place
  reconnect), and an exhausted included allowance is recovered in Agent
  Settings. None of the three may require an app restart. Renderer code selects
  by the assigned kind and never parses provider prose; what the replacement
  renderer currently offers is a Known Gap in
  [Agent Panel](agent-panel.md#known-gaps).
- Skills are discovered and invoked through native capability paths. The
  runtime never exposes or concatenates skill-file contents into a prompt.

## Known Gaps

Required behavior is stricter than Current behavior in each of these. Every
gap below is observed in Shipping.

- **OpenCode directory rebind.** An attributed OpenQuill unbound chat
  participates in `create_project`. The live panel scope changes and subsequent
  MCP operations remain attached to that session and window. OpenCode 1.18.19
  has no supported operation for moving the same native session between
  directory projects, so the Adapter claims no durable session-folder override.
  Restored history remains under unbound history, and the continued chat stays on its
  safe MCP-only agent profile rather than enabling native commands against the
  old folder-home cwd.
- **An instruction edit does not reach a running session.** Resolved
  instructions are injected once, when a native session mounts, and no Adapter
  grows a live setter for them. A save is therefore effective for the next
  session that mounts under that scope. Nothing remounts a conversation that is
  already open, so a save never reaches the conversation whose composer opened
  the editor.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Agent Interface | `AgentAdapter`, normalized client/server events, scope resolution, attach, and stop in `server/agent-contract.ts` |
| Socket upgrade Adapter | `server/websocket-upgrade.ts`, composed by `server/index.ts`; real upgrade routing is exercised by `server/websocket-upgrade.test.ts` in `pnpm test:conversion-scheduler` |
| Adapter registry | `server/agent-adapters.ts` |
| StashBase/OpenCode Adapter | `server/opencode-runtime.ts`, `server/opencode-agent.ts`, and `server/hosted-agent-broker.ts` |
| Turn failure classification | `classifyAgentTurnFailure` in `server/agent-turn-failure.ts` over the shared kinds in `shared/agent-protocol.ts`. The kind crosses the socket schema in `shared/protocols/websocket/agent-session.ts` and reaches renderer transcript state; what the renderer currently does with it is a Known Gap in [Agent Panel](agent-panel.md#known-gaps) |
| Preparation Interface | `AgentBootstrapCoordinator` and its structured failure contract in `server/agent-runtime-installer.ts`; discovery and one-shot debug controls in `server/agent-cli.ts` and `server/agent-runtime-paths.ts` |
| MCP wiring | `ensureAgentMcp` and the launcher writer in `server/agent-mcp.ts` |
| Claude Adapter | `server/agent.ts` and its SDK/native-process helpers |
| Codex Adapter | `server/codex-session-runtime.ts`, `codex-rpc-transport.ts`, `codex-protocol.ts`, and `codex-history.ts`; `codex-model-catalog.ts` is the one reading of `model/list` a session and the runtime-level read share |
| Model catalog memory | `server/agent-model-catalog.ts` remembers each runtime's catalog and observed default and reads Codex's without a session; `server/claude-model-catalog.ts` reads Claude's from a bare SDK handshake plus its user settings; `server/routes/terminal.ts` primes the memory before the listing answers |
| Scope/history owners | `server/agent-session-registry.ts`, `agent-session-folders.ts`, `agent-projects.ts`, and session routes |
| Agent Instructions Interface | `assets/agent-instructions/default.md` and `assets/agent-instructions/unbound.md` own the two product defaults; `server/agent-instructions.ts` owns scope matching, defensive reads, clearing, and config compaction; `server/routes/agent-instructions.ts` is the authorized HTTP Adapter over the wire shapes in `shared/agent-instructions.ts` and `shared/protocols/http/agent-instructions.ts`; `server/agent-runtime-instructions.ts` owns the separate internal routing policy and native-session composition |
| Renderer Adapters | `renderer/src/features/agent/infrastructure/catalog-api.ts` maps the runtime catalog to whether a conversation can send, `renderer/src/features/agent/infrastructure/session-api.ts` maps the socket and history vocabulary, and `renderer/src/features/agent/infrastructure/agent-instructions-api.ts` maps the instructions routes. Session and tab lifetime is `renderer/src/features/agent/application/workspace-runtime.ts`. Renderer-side rules are [Agent Panel](agent-panel.md) |
| Focused evidence | `server/agent-instructions.test.ts`, `server/__tests__/agent-contract.test.ts`, `opencode-agent.test.ts`, `hosted-agent-broker.test.ts`, `opencode-native-smoke.test.ts`, `agent-runtime-installer.test.ts`, `agent-turn-failure.test.ts`, `agent-projects.test.ts`, `codex-agent.test.ts`, and `agent.test.ts` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:agent
pnpm test:config
pnpm test:protocols
pnpm test:agent:native
pnpm test:opencode:native
```

`pnpm test:config` is where the Agent Instructions store is proven, and
`pnpm test:protocols` covers the Agent wire schemas. Journey automation retired
with the Playwright suites. When the Codex vocabulary changes, prove it through
the agent server suite. Prove renderer-visible lifecycle changes with focused
renderer tests and a driven runtime pass through the built application.
Packaged discovery and one credentialed real-CLI turn remain release sanity
checks.

Related journeys: [J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat)
and the [J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop. Live session attribution and rebind also support
[J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project).
Related contracts: [Agent Panel](agent-panel.md), [MCP Access](mcp-access.md),
and [Window Lifecycle](window-lifecycle.md).

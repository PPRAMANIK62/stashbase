# Agent Runtime

> Review contract for supported CLI discovery, managed installation, MCP
> preparation, native session ownership, history, and protocol normalization.

## Discovery and Preparation

- App boot and folder navigation perform only cheap discovery and idempotent
  MCP repair for already installed runtimes. They never install an Agent or run
  a login-shell probe.
- New Chat opens readiness for the selected Agent but does not itself authorize
  a download. Discovery prefers a supported system executable, then a managed
  executable under AppData. If neither exists, the Agent gate waits for
  **Install and continue** (or the explicit Settings install action) before
  installing only that Agent's official runtime. Opening, switching, or
  resuming a tab never installs another runtime as a side effect.
- Managed runtimes never modify `PATH` and continue using the provider's normal
  account and history home. Resetting a managed executable never clears login
  or native history.
- Settings offers Uninstall only for a StashBase-managed runtime, never for a
  system executable. It stops that agent's sessions, resets preparation state,
  and removes only the private install under AppData (the removal path-guards
  to that root). Uninstall is disk reclamation, not deactivation: the next
  explicit New Chat re-runs readiness.
- Codex uses its official standalone installer in a private target. Its
  installer process and immediate executable check share that isolated
  installer environment. On Windows, installation prefers PowerShell 7 from
  the inherited PATH or its standard Program Files location, then falls back
  to Windows PowerShell; a known legacy-shell architecture failure names the
  PowerShell 7 recovery instead of becoming a generic executable-check error.
  Native sessions still use the provider's normal account and history home.
  Claude uses its official release manifest, verifies size and SHA-256, and
  publishes atomically. Disposable staging cleanup retries transient Windows
  locks and never replaces the primary download or executable-check failure;
  failed executable checks retain bounded timeout, exit-code, and stderr
  diagnostics. Shutdown cancels preparation.
- Readiness configures the matching CLI's StashBase MCP entry through
  `ensureAgentMcp`, the only writer of the built-in agents' own config files.
  Native attach repeats that idempotent write immediately before process
  start. There is no user-facing connect/disconnect for built-in agents; MCP
  is part of readiness, and Settings surfaces a repair action only on
  failure.
- Preparation is one staged Interface: discover, install only when missing,
  then configure MCP. Its failure contract names `stage`, `code`, a bounded
  message, retryability, and an optional manual recovery. Renderer code must
  not classify failures by parsing messages. Installation failure may expose
  the provider install command; MCP failure may expose the read-only manual MCP
  setup, never an install command.
- Retry calls the same preparation Interface. Fresh discovery skips a completed
  installation, so an MCP retry rewrites only the idempotent MCP configuration;
  no parallel repair state machine exists.
- Development failure injection is one mutually exclusive, in-memory
  `nextFailure` value. It is consumed only when explicit readiness reaches that
  stage and immediately resets to normal; background startup repair never
  consumes it, and an installation injection stays pending when an existing
  runtime skips installation. Settings presents these controls inside a
  visually distinct development-only surface; production omits the surface.
  Availability follows the general development-runtime marker and does not
  depend on whether the renderer is served through Vite.
- A discovery, installation, or MCP failure is visible and retryable but never
  blocks the workspace or silently substitutes another Agent.

## Session Scope and Lifetime

An Agent session binds to `{ kind: 'library' }` or an authorized member folder.
Missing scope uses the window's current folder or Library when none is active;
it is not a third scope.

- A library session uses the reserved folder-home cwd and retrieves through
  library MCP. It does not create member-folder instruction files.
- A folder session uses that folder's cwd. `AGENTS.md` is create-only;
  Claude's `CLAUDE.md` bridge is create-only. Both remain visible user files.
- Window folder switching does not tear down or rebind started sessions.
- Folder removal ends every session bound to that member across windows but
  does not end library sessions. Window close ends that window's sessions;
  app quit ends all sessions through the cleanup ladder.
- `create_project` may migrate only the attributed live library session.
  Persist the session-to-folder override before emitting the scope change so
  history never lists the session in both scopes. Preserve native session
  identity while moving subsequent execution to the project cwd: Codex keeps
  its thread and changes the next turn cwd; Claude lets the creating turn
  finish, then resumes the same native session from the project cwd before
  accepting the next prompt.

## Native Process Ownership

- One live Codex chat owns one app-server process and one thread. History
  clients have separate process ownership and may share only their RPC
  vocabulary and a bounded idle cache.
- Every process exit/dispose rejects pending RPC work. Closed peers discard
  later inbound messages. A generation token prevents events from a retired
  process from settling or clearing a replacement generation.
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

- Model catalogs and effort levels come from the native runtime. `Default`
  means no override and never rewrites global CLI configuration.
- Attachments are explicit; the current source is never implicit context.
- Permission callbacks normalize into one renderer approval flow. Access policy
  remains outside transport/process modules.
- Runtime errors settle only the matching active turn once. Retry-in-progress
  signals do not become permanent failures; repeated or late terminal events
  are ignored.
- Skills are discovered and invoked through native capability paths. The
  runtime never exposes or concatenates skill-file contents into a prompt.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Agent Interface | `AgentAdapter`, normalized client/server events, scope resolution, attach, and stop in `server/agent-contract.ts` |
| Adapter registry | `server/agent-adapters.ts` |
| Preparation Interface | `AgentBootstrapCoordinator` and its structured failure contract in `server/agent-runtime-installer.ts`; discovery and one-shot debug controls in `server/agent-cli.ts` and `server/agent-runtime-paths.ts` |
| MCP wiring | `ensureAgentMcp` and the launcher writer in `server/agent-mcp.ts` |
| Claude Adapter | `server/agent.ts` and its SDK/native-process helpers |
| Codex Adapter | `server/codex-session-runtime.ts`, `codex-rpc-transport.ts`, `codex-protocol.ts`, and `codex-history.ts` |
| Scope/history owners | `server/agent-session-registry.ts`, `agent-session-folders.ts`, `agent-projects.ts`, and session routes |
| Renderer Adapter | `web-src/src/agentCatalog.tsx`, `components/agent/chatActivation.ts`, `components/agent/runtimeFailurePresentation.ts`, and [Agent Panel](agent-panel.md) |
| Focused evidence | `server/__tests__/agent-contract.test.ts`, `agent-runtime-installer.test.ts`, `agent-projects.test.ts`, `codex-agent.test.ts`, `agent.test.ts`, and `e2e/fixtures/fake-codex-app-server.test.mjs`; J11 in `e2e/journeys/agent-workflows.spec.ts` proves the first post-rebind MCP write lands in the project |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:agent
pnpm test:agent:native
```

Run `pnpm test:e2e:agent-protocol` when the Codex vocabulary changes and
`pnpm test:e2e:functional` for renderer-visible lifecycle changes. Packaged
discovery and one credentialed real-CLI turn remain release sanity checks.

Related journeys: [J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat)
and the [J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop. Live session attribution and rebind also support
[J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project).
Related contracts: [Agent Panel](agent-panel.md), [MCP Access](mcp-access.md),
and [Window Lifecycle](window-lifecycle.md).

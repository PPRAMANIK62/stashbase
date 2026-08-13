# Agent Runtime

> Review contract for supported CLI discovery, managed installation, MCP
> preparation, native session ownership, history, and protocol normalization.

## Discovery and Preparation

- App boot and folder navigation perform only cheap discovery and idempotent
  MCP repair for already installed runtimes. They never install an Agent or run
  a login-shell probe.
- The first explicit New Chat action owns readiness for the selected Agent.
  Discovery prefers a supported system executable, then a managed executable
  under AppData. If neither exists, only that Agent's official runtime is
  installed.
- Managed runtimes never modify `PATH` and continue using the provider's normal
  account and history home. Resetting a managed executable never clears login
  or native history.
- Codex uses its official standalone installer in a private target. Claude uses
  its official release manifest, verifies size and SHA-256, and publishes
  atomically. Shutdown cancels preparation.
- Readiness configures the matching CLI's StashBase MCP entry. Native attach
  repeats that idempotent write immediately before process start.
- A discovery, installation, or config failure is visible and retryable but
  never blocks the workspace or silently substitutes another Agent.

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
  history never lists the session in both scopes.

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
| Preparation Interface | `AgentBootstrapCoordinator` in `server/agent-runtime-installer.ts` plus discovery paths in `server/agent-cli.ts` |
| Claude Adapter | `server/agent.ts` and its SDK/native-process helpers |
| Codex Adapter | `server/codex-session-runtime.ts`, `codex-rpc-transport.ts`, `codex-protocol.ts`, and `codex-history.ts` |
| Scope/history owners | `server/agent-session-registry.ts`, `agent-session-folders.ts`, `agent-projects.ts`, and session routes |
| Renderer Adapter | `web-src/src/agentBootstrap.ts`, `agentCatalog.tsx`, and [Agent Panel](agent-panel.md) |
| Focused evidence | `server/__tests__/agent-contract.test.ts`, `agent-runtime-installer.test.ts`, `agent-projects.test.ts`, `codex-agent.test.ts`, `agent.test.ts`, and `e2e/fixtures/fake-codex-app-server.test.mjs` |

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

Related journey: [J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat).
Related contracts: [Agent Panel](agent-panel.md), [MCP Access](mcp-access.md),
and [Window Lifecycle](window-lifecycle.md).

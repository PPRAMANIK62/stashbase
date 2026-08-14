# Settings and Config

> Review contract for durable application preferences, credentials, Settings
> UI, migration, and runtime reconfiguration.

## Ownership and Interface

`server/app-config.ts` is the single persistent app-config Module and the Node
server is its only writer. Domain routes expose narrow Interfaces for
appearance, onboarding, embedding, transcription, and MCP transport settings.
Renderer panels are Adapters over those routes; they do not own durable truth.

Managed Agent runtimes, models, derived data, and caches live under AppData and
are not app-config fields. Supported client configuration files are owned by
their clients and are updated only through explicit MCP setup actions.

## Persistence Invariants

- The config path is `~/.stashbase/config.json`. Successful writes are atomic
  and restrict POSIX modes to the owning user; readers validate and normalize
  domain values before exposing them.
- A strict read or write reports malformed, inaccessible, or unwritable state.
  A fallback read may preserve app availability but must not pretend a failed
  write persisted.
- The app never changes user-managed filesystem ownership, flags, or ACLs to
  repair an unwritable config directory. Errors name the user-actionable config
  location without leaking atomic temporary paths.
- BYOK credentials are accepted and persisted only through Settings. Account
  OAuth may start from explicit setup, Settings, or account-menu Sign in
  actions, but only the Node server persists its session. Environment
  variables may isolate automated tests or select runtime plumbing, but are
  never the product credential source of truth.
- BYOK credentials, the refreshable Supabase account session, and the active
  embedding source persist independently. Switching sources retains the
  inactive credential and never silently falls back after a hosted failure.
- Account access and refresh tokens are Node-only configuration. They never
  cross renderer HTTP responses or the Node/Python boundary; Python receives a
  random per-process loopback bearer credential instead.
- Browser provider login uses PKCE. Node generates and retains the verifier,
  accepts the short-lived authorization code only on a loopback callback, and
  exposes an opaque flow id plus pending/complete/error state to the renderer.
  After observing `complete`, the renderer may request native focus through a
  narrow IPC channel; no provider code or account token crosses that channel,
  and the browser callback page remains the fallback. Its app-return deep link
  is a fixed, data-free action and never carries a flow id, provider code, or
  account token.
- Read-modify-write helpers preserve unrelated config domains. Concurrent MCP
  listener transitions serialize and roll active exposure back if persistence
  fails.
- Migration is idempotent and loss-averse. Invalid legacy state must not erase
  a valid current value or silently select a different provider.
- Updating configuration invalidates or reconciles only the dependent runtime:
  appearance updates the renderer, embedding affects semantic readiness,
  transcription affects preparation, and MCP HTTP settings affect the
  listener. Ordinary browsing and exact search remain available on failure.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Persistent Interface | strict/fallback read and write plus domain getters/setters in `server/app-config.ts` |
| Domain owners | `server/mcp-http-settings.ts`, `server/hosted-account.ts`, `server/hosted-embedding-broker.ts`, embedding and transcription configuration Modules |
| HTTP Adapters | `server/routes/appearance.ts`, `onboarding.ts`, `account.ts`, `embedder.ts`, `transcription.ts`, `mcp.ts` |
| Renderer Adapters | `web-src/src/components/SettingsModal.tsx`, `components/settings/AppearancePanel.tsx`, `EmbeddingPanel.tsx`, `TranscriptionPanel.tsx`, `McpClientsPanel.tsx`, `AgentRuntimePanel.tsx` |
| Appearance Adapter | `web-src/src/appearance.ts` |
| Focused evidence | `server/app-config.test.ts`, `server/hosted-account.test.ts`, `server/__tests__/mcp-http-settings.test.ts`, `web-src/src/__tests__/appearance.test.ts`, `web-src/src/__tests__/embedding-auth.test.ts`, `e2e/smoke/settings.spec.ts` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:config
pnpm test:mcp
pnpm test:renderer
```

Run `pnpm test:e2e:smoke` for Settings navigation or persisted appearance.
Run the affected conversion, Agent, or MCP suite when a setting changes its
runtime behavior. Never use a real credential in a fixture or diagnostic.

Related journeys: [J01](../design-docs/user-journeys.md#j01-launch-into-a-usable-workspace),
[J04](../design-docs/user-journeys.md#j04-prepare-a-hard-to-read-file),
[J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat), and
[J08](../design-docs/user-journeys.md#j08-connect-an-external-agent-through-mcp).
Related contracts: [MCP Access](mcp-access.md), [Agent Runtime](agent-runtime.md),
and [Data Lifecycle](data-lifecycle.md).

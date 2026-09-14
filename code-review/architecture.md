# Architecture

> Cross-cutting engineering map. Product-level boundaries live in
> [design-docs/architecture.md](../design-docs/architecture.md); focused
> invariants live in the contracts linked below.

## Runtime Shape

```text
Electron renderer windows
        │ per-window identity over HTTP / WebSocket
        ▼
Node application server
  ├─ local file operations and preparation orchestration
  ├─ Agent Panel bridge
  ├─ MCP transports and library operations
  └─ Supabase session and OpenQuill model bridge
        │
        ▼
Python indexing daemon → one local MFS store
        │ BYOK embedding requests
        ▼
OpenAI or OpenRouter
```

One application session may own several renderer windows. They share the Node
server, Python daemon, library membership, settings, derived state, and MCP
service. Each renderer retains its own active folder, documents, search
presentation, and Agent tabs.

## Ownership Boundaries

- The user owns source files and visible `AGENTS.md` / `CLAUDE.md` files;
  StashBase never creates or rewrites those runtime-native inputs.
- The Node server owns authorized filesystem operations, format preparation,
  reconcile orchestration, Settings writes including scoped Agent Instructions,
  MCP, and Agent adapters.
- The Python daemon uses public MFS APIs for projection content revisions,
  document status, unchanged classification, chunking, embeddings, vector
  storage, and semantic retrieval. It receives text and source identity; it
  never decides how a source format is converted. It receives only the
  configured OpenAI or OpenRouter BYOK credential.
- The Node server alone stores and refreshes the optional account session for
  OpenQuill. That session never selects an embedding source or crosses into the
  Python daemon.
- Renderer state is presentation and request coordination, not durable data
  truth. It cannot define preparation completion, index currency, file
  versions, or library membership.
- Settings is the only product surface for BYOK credentials. Account OAuth may
  start from explicit setup, Settings, or account-menu Sign in actions; its
  refreshable session remains Node-owned. Environment variables may select
  isolated test/runtime seams but are never the user's credential source of
  truth.
- Settings persistence remains atomic and fails closed when its path is not
  writable. The application reports the failure but never repairs filesystem
  ownership, flags, or ACLs on the user's behalf.

## Primary Data Flow

```text
source file
  → direct text or format preparation
  → exact retrieval and optional semantic index
  → visible-source evidence
  → built-in or external Agent through the same MCP operations
  → explicit source-file write
  → reconcile into future context
```

Generated text and index rows are rebuildable. Every read, result, and mutation
that crosses a product boundary retains or resolves to an authorized visible
source file.

The desktop popup's semantic path uses the same folder-explicit
`POST /api/library/search` that powers MCP `search_library`; its exact path
uses the folder-explicit `POST /api/library/keyword-search`. A Folder root is
required unless an attributed folder Chat supplies it, and an optional
escape-safe subfolder prefix may narrow either call.
`normalizeLibrarySearchScope` rejects a prefix outside the requested Folder
instead of silently widening. File-type category chips are
agent-facing only (`shared/search-types.ts` defines and validates the
`notes` / `pdf` / `image` / `docx` / `audio` vocabulary; `server/format.ts`
maps categories to source extensions). Scope and type narrowing compose; the
semantic path filters daemon results back to `top_k`, while the exact path
uses MFS `grep` with namespace, path-prefix, extension, byte, document, and
global-match bounds. Both report truncation when a configured bound omits matches. Display-path
remapping is unchanged: filters act on source paths, and derived notes never
surface.

## Cross-process Contracts

- Every renderer request carries a stable window identity, and Electron main
  is the one that stamps it. `installRequestAuthorization` in
  `electron/renderer/requests.cjs` cancels any renderer request outside `/api/`
  and `/ws/agent`, requires the sender's `webContents` and main frame to match a
  live window registration on an allowed renderer origin, and then overwrites
  the window-identity header. A renderer cannot choose or forge its own
  identity. Folder context is a server-side binding, never a global
  current-folder variable.
- Shared services outlive an individual window. Window retirement cannot close
  the server, daemon, settings, or MCP resources while peers remain.
- The server is the only owner allowed to bind folders into the daemon. Callers
  use folder-explicit operations instead of temporarily changing global
  context.
- The server serializes daemon generations: concurrent reset callers share one
  retirement barrier, and callbacks from an older child cannot mutate the
  current generation's process or request state.
- Application quit is an authenticated owner-to-server shutdown handshake.
  Signals are timeout fallbacks, not the normal cleanup path.
- The shutdown ladder closes MCP, Agent-install, GitHub-import, conversion,
  database, and indexer resources independently so one cleanup failure cannot
  skip the others.
- Static renderer serving must bypass every API and asset route before serving
  the web bundle.
- `shared/file-formats.ts` and `shared/library-files.ts` carry the exact
  renderer/server tree contract. `generic` widens Workbench visibility only;
  the server's known-format detector remains the narrower retrieval and Agent
  admission boundary. Generic preview uses its own read-only route rather than
  widening `/api/files`, library operations, or MCP.

## Renderer Trust Boundary

Renderer windows are untrusted presentation. Every window runs Chromium
sandboxed with context isolation and no Node integration, loads its built
bundle from the privileged `app://renderer` application origin, and receives a
strict Content Security Policy on every response from that origin's handler.
The policy starts from `default-src 'none'`, admits script only from the
application origin, allows framing only of the server's asset routes, and
limits connections to the application origin plus the loopback server and its
WebSocket origin. `electron/app-protocol.cjs` owns the origin, the policy, and
path containment under the renderer root.
`electron/window-security.cjs` owns the shared web preferences and denies
navigation away from that origin, popups, `webview` attachment, and every
permission request.

Native capability crosses only through a bundled typed preload that exposes one
narrow method group per capability and never the raw `ipcRenderer`. Main
authorizes each call before acting on it. `authorizeSender` in
`electron/library/dialog.ts` requires a live sender window, the sender's own
main frame, an expected frame origin, and an explicit capability grant recorded
for that window at creation; the handler then parses the payload against the
shared wire schema under `shared/protocols/electron/`. Authorization identity
belongs to main, never to the renderer that asked.

The renderer keeps no browser storage. Durable window state goes to the
workspace-session bridge or the server, and the composition root disables the
installed sidebar primitive's cookie persistence rather than inheriting it.

Window creation, preload composition, and retirement live in
[Window Lifecycle](window-lifecycle.md).

## Responsiveness Allocation

Work is placed by which owner can afford to block. Electron main owns native
orchestration and no product policy. The renderer thread owns interaction only.
Expensive view work moves off it into a Web Worker, as the DOCX preview does in
`renderer/src/features/documents/infrastructure/docx-preview.worker.ts`.
Filesystem, conversion, indexing, and every other durable operation belongs to
the Node server and its sidecars.

A window paints a minimum safe shell first and lets its noncritical
capabilities settle independently; `renderer/src/app/bootstrap/use-boot-progress.ts`
publishes the settled state once the library has answered and no folder restore
is still running. Loading never replaces safe content or blocks local
interaction. Optimistic update is confined to reversible low-risk metadata;
nothing that decides durability may be presented before its owner confirms it.

**Known gap — no measured performance budget.** Bundle, startup, interaction,
long-task, and memory budgets are intended and not established. The renderer
gates gathered under `pnpm check:web` enforce source file size
(`scripts/renderer/size.mjs`), layer boundaries, and coverage, none of which
observe runtime cost, so no automated check would catch a responsiveness
regression.

## Durable Seams

The main ownership seams are intentionally narrower than this map:

- [Window Lifecycle](window-lifecycle.md) — renderer readiness, save barriers,
  identity retirement, multi-window behavior, and shutdown.
- [Bug Reporting](bug-reporting.md) — local collection, sender-bound review,
  immutable approval, artifact handoff, and privacy.
- [Renderer Workspace](renderer-workspace.md) — per-window folder, document,
  retrieval, and shell transition ownership.
- [Data Lifecycle](data-lifecycle.md) — preparation, indexing, reconcile,
  cancellation, and derived-state cleanup.
- [File Transactions](file-transactions.md) — path safety and durable source
  mutations.
- [Document Viewers](document-viewers.md) — non-Markdown preview and content
  trust boundaries.
- [Settings and Config](settings-config.md) — durable configuration and
  runtime reconfiguration.
- [MCP Access](mcp-access.md) — external and built-in library access.
- [Agent Runtime](agent-runtime.md) — CLI discovery, preparation, native
  sessions, and history.
- [Release Pipeline](release-pipeline.md) — CI and packaged native ownership.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Renderer workspace Interface | `WorkspaceRuntime` in `renderer/src/features/workspace/application/runtime.ts`, reached through the hooks in `renderer/src/features/workspace/hooks/` |
| Window/context owners | `electron/main.cjs`, `electron/multi-window.cjs`, `server/folder.ts`, `server/routes/window-context.ts` |
| Application server composition | `server/index.ts`, with focused behavior behind route and service Modules |
| Data lifecycle Interfaces | `server/conversion-dispatch.ts`, `server/conversion-scheduler.ts`, `server/indexer.ts`, `server/mfs-daemon.ts` |
| Library/MCP Interface | `LibraryOperations` in `server/library-operations/index.ts` |
| Agent Interface | `AgentAdapter` and normalized events in `server/agent-contract.ts` |
| Process Adapters | Electron preload/HTTP, MCP stdio/HTTP, Agent native protocols, and the Python daemon protocol |

This map names ownership Seams, not every runtime file. Follow the focused
contract before reading an owner Module's internals.

## Architectural Review Questions

- Has an owner changed, or has a second owner been introduced for the same
  state?
- Can a window, request, task, or process finish after its identity is stale?
- Can derived or renderer state be mistaken for source truth?
- Can a folder-explicit operation accidentally depend on whichever folder a
  window currently shows?
- Does a failure release every resource while preserving a recoverable source?
- Does a new surface bypass the library membership, path, credential, or
  permission boundary?

## Validation

Run `pnpm typecheck` for every implementation change. Cross-process ownership
changes also run `pnpm test:electron` and `pnpm test:electron:smoke`; renderer
boundary changes run `pnpm check:web`. Add the exact suites from every focused
contract crossed by the change. Use [Journey Coverage](journey-coverage.md) to
choose the evidence layer a changed journey needs.

Related journey: [J09](../design-docs/user-journeys.md#j09-prepare-and-hand-off-a-bug-report)
for the bug-report review process boundary. Other architectural changes use the
focused journey routes in [Journey Coverage](journey-coverage.md).

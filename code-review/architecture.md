# Architecture

> Cross-cutting engineering map. Product-level boundaries live in
> [design-docs/architecture.md](../design-docs/architecture.md); focused
> invariants live in the contracts linked below.

The implemented capabilities support a project-first writing workflow:
brainstorm, write, and refine, using file preparation and retrieval when
useful. An empty project does not require an index or wiki before discussion.
Document-specific diff remains a separate unfinished experience; it does not
change the current source-of-truth or process ownership model.

## Runtime Shape

```text
Electron renderer windows
        │ per-window identity over HTTP / WebSocket
        ▼
Node application server
  ├─ local file operations and preparation orchestration
  ├─ Agent Panel bridge
  ├─ MCP transports and project operations
  └─ Supabase session and OpenQuill model bridge
        │
        ▼
Python indexing daemon → one local MFS store
        │ BYOK embedding requests
        ▼
OpenAI or OpenRouter
```

One application session may own several renderer windows. They share the Node
server, Python daemon, project registration, settings, derived state, and MCP
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
  versions, or project registration.
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
`POST /api/project/search` that powers MCP `search_project`; its exact path
uses the folder-explicit `POST /api/project/keyword-search`. A Folder root is
required unless an attributed folder Chat supplies it, and an optional
escape-safe subfolder prefix may narrow either call.
`normalizeProjectSearchScope` rejects a prefix outside the requested Folder
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

- Electron main observes every renderer request to the local HTTP and WebSocket
  origins. `installRequestAuthorization` in `electron/renderer/requests.cjs`
  admits canonical `/api/` requests and the exact `/ws/agent` endpoint only
  from a registered live window's main frame on the expected origin, and
  overwrites any claimed window-identity header. Alternate path spellings and
  retired socket aliases cannot bypass this check. Read-only asset and PDF
  resources carry no window authority; their server-owned path and membership
  checks also serve document frames and workers. Explicit Vite development
  additionally permits static reads and the registered main frame's root HMR
  socket. Folder context remains a server-side binding, never a global
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
- Startup readiness belongs to the spawned server instance, not merely a
  compatible listener on its port. The launch identity and bounded orphan
  recovery are owned by [Window Lifecycle](window-lifecycle.md).
- The shutdown ladder closes MCP, Agent-install, GitHub-import, conversion,
  database, and indexer resources independently so one cleanup failure cannot
  skip the others.
- Static renderer serving must bypass every API and asset route before serving
  the web bundle.
- `shared/file-formats.ts` and `shared/project-files.ts` carry the exact
  renderer/server tree contract. `generic` widens Workbench visibility only;
  the server's known-format detector remains the narrower retrieval and Agent
  admission boundary. Generic preview uses its own read-only route rather than
  widening `/api/files`, project operations, or MCP.

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
ambient permission check. One permission request is granted, and only when the
requesting frame is the application origin itself: the sanitized clipboard
write, which is how a value the reader asked a panel to copy leaves the window.
Reading the clipboard stays denied, because a paste arrives as an event and
needs no permission. The grant reaches the bundled renderer and nothing else,
since document content renders at an opaque origin with no permission
capability at all. The permission name is Chromium's, not a readable synonym:
a handler that answers the wrong one denies silently, and the renderer can only
report that the clipboard could not be reached, so a change to it is proven by
driving a real window rather than by reading the code.

Native capability crosses only through a bundled typed preload that exposes one
narrow method group per capability and never the raw `ipcRenderer`. Main
authorizes each call before acting on it. `authorizeSender` in
`electron/project/dialog.ts` requires a live sender window, the sender's own
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
publishes the settled state once the project registry has answered and no folder restore
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
- [MCP Access](mcp-access.md) — external and built-in project registry access.
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
| Project/MCP Interface | `ProjectOperations` in `server/project-operations/index.ts` |
| Agent Interface | `AgentAdapter` and normalized events in `server/agent-contract.ts` |
| Process Adapters | Electron preload/HTTP, MCP stdio/HTTP, Agent native protocols, and the Python daemon protocol |

This map names ownership Seams, not every runtime file. Follow the focused
contract before reading an owner Module's internals.

The Node server owns lazy PDF/OCR component installation and its waiting
conversion tasks; Electron startup requires only the bundled index daemon.
See [component installation](data-lifecycle.md#pdfocr-component-installation)
and [release packaging](release-pipeline.md) for the trust and publication contracts.

## Architectural Review Questions

- Has an owner changed, or has a second owner been introduced for the same
  state?
- Can a window, request, task, or process finish after its identity is stale?
- Can derived or renderer state be mistaken for source truth?
- Can a folder-explicit operation accidentally depend on whichever folder a
  window currently shows?
- Does a failure release every resource while preserving a recoverable source?
- Does a new surface bypass the project registration, path, credential, or
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

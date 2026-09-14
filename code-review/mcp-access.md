# MCP Access

> Review contract for MCP tool behavior, transport exposure, credentials, and
> authorized project scope.

## Projects, One Operation Layer

The Agent Panel and external clients call the same project operations.
Stdio, Streamable HTTP, and app HTTP routes are adapters over that operation
layer; none may implement a broader filesystem path or a different source
identity rule.

Core operations provide project discovery, search, reindex, bounded read and
write helpers, and project creation. File helpers exist for sandboxed local
clients and are not a general host-filesystem API.

## Access Invariants

- Each registered folder owns one search namespace. `reindex` and index-status
  require a folder; omission never traverses or aggregates all projects.
  `list_directory` requires an absolute directory path. Project discovery is
  the separate `list_projects` operation, not a virtual filesystem root.
- Attributed HTTP file operations retain the Chat's bound project across
  asynchronous work. Search selects that exact namespace; file paths stay
  inside its root, including descendants that are also registered as projects.
  Stale session ids fail; an unbound Chat cannot read or mutate a project. Native tools in user-installed coding Agents remain
  governed by that runtime's separate permissions.

- Every file path resolves under an authorized registered project. Hidden derived
  data is not listable or writable; a read may consume manifest-known current
  derived text only through its live visible source.
  Agent context metadata and HTTP/MCP reads share the format owner's current
  output check: source freshness, complete output, and preparation status must
  agree. A legacy manifest path is resolved back to its source before scope
  and containment checks; a deleted source cannot leave a readable orphan.
- Search defaults only from an attributed live folder Chat. Exact session
  identity wins; legacy window identity is usable only for its sole active
  turn. Stale or ambiguous supplied identity fails rather than widening.
  Unbound Chats have no project-file access. External callers must pass one
  `folder` from `list_projects`; search never borrows the app-wide sole active
  turn. An attributed folder Chat cannot override its bound project.
  `path_prefix` must stay inside the effective member Folder. Invalid
  narrowing fails; it never silently widens. Responses report that Folder.
- `search_project(query, mode?, folder?, path_prefix?, types?, case_strict?,
  whole_word?, top_k?)` keeps the HTTP/MCP values `semantic` and `keyword`
  for compatibility. Adapters map them to internal `hybrid` and `grep`; responses
  map the effective strategy back to the wire vocabulary. An omitted mode
  remains omitted through both MCP transports and resolves in Project Operations
  from current key configuration: grep without a key, hybrid with one.
  Explicit modes are honored; missing configuration for hybrid returns 412,
  and provider failures are never silently downgraded. Invalid modes remain
  errors, not omission. Both strategies use the same one-Folder boundary and
  `types` accepts the shared source categories.
- Session attribution constrains the bound project. A bound Chat cannot
  override that project, even with another registered path. External clients
  may select one registered project per request. Tool descriptions state this
  distinction and never advertise an unavailable per-Chat search control.
- Results retain absolute visible-source identity for Agent tools. Converted
  evidence never exposes an AppData path.
- `list_projects` returns folder identity and provider state, not a second
  folder-description or Agent Instructions store. StashBase Chat instructions
  remain distinct from the panel Runtime Adapter's internal project-routing
  policy. The MCP server publishes capability and tool descriptions but no
  second top-level instruction prompt; user-owned portable rules may remain
  visible source in `AGENTS.md`.
- File mutations use the shared transaction/version boundary and schedule or
  reconcile index maintenance after success.
  `edit_file` treats replacement text literally in both single and global
  edits, including dollar sequences used in Markdown and code.
- `list_directory` enumerates only the requested directory surface and does
  not read file bodies. `read_file` has an `8 MiB` response ceiling for source
  and current derived text; oversized content fails explicitly rather than
  consuming unbounded server memory.
- `read_file` accepts an optional 1-based `offset`/`limit` line window over
  every readable family, direct and derived alike. The window is applied after
  the bounded read, so it narrows what a caller receives and never widens what
  the server admits: a source above the read ceiling stays unreadable in every
  window. A malformed bound is a `400`, never a silent whole-file read.
- A windowed response is self-describing — `partial`, `totalLines`, and a
  `nextOffset` that is absent once the window ends the file — and omits
  `version`. Dropping the version token keeps a window outside the optimistic
  write path, so a partial read cannot be laundered into a version-checked
  full-file overwrite.
- The Workbench tree is intentionally wider than the Agent file surface.
  Generic files, user dotfiles admitted only by the Workbench, excluded-folder
  placeholders, symlinks, and special entries do not appear in
  `list_directory` and cannot be read or mutated by these tools.
- Format capability follows the
  [Documents matrix](../design-docs/design/documents.md#format-capability-matrix):
  `read_file` returns direct Markdown, HTML, JSON, or valid UTF-8 TXT source
  text and current prepared PDF, DOCX, or media text; it does not return image
  bytes. `write_file` and `edit_file` accept those four direct-text families.
  Invalid UTF-8 TXT fails explicitly and is never rewritten. Generic
  workspace-only files are neither listed nor readable through MCP.
  Previewability or built-in image attachment support must not be generalized
  into external MCP text-read capability.
- `create_project` creates only beneath the default folder home or an already
  authorized location. Both the selected location and creatable target must
  remain inside that owned root after symlinks are resolved. The operation
  registers an empty folder and never seeds Agent instruction files.
  Session rebind requires trusted live-session attribution; ambiguous or
  external callers only create and register. Supplied session identity is
  authoritative even when stale or blank; only its absence permits the owning
  window's sole active turn to identify the caller. App-wide turn activity is
  never request attribution, including for retrieval preferences. The HTTP
  creation Adapter preserves supplied identity and never substitutes a default
  window; creation uses its own location authorization before existing-file
  request scoping, so stale callers can create without gaining file access.

## Transports and Credentials

- Local stdio is reachable only by the spawning local client and has no second
  auth protocol.
- Streamable HTTP requires the live bearer token from Settings on every POST.
  Rotation invalidates the old token without restart.
- The application server stays on loopback. Docker access is explicit opt-in
  through a separate host-facing listener whose app mounts only `/mcp` and
  still requires the bearer token.
- Browser Origins and CORS remain closed to page clients. URL access is a
  server-client transport.
- Desired Docker state and port are durable; active listener state is runtime
  only. Listener transitions serialize, report bind/config errors, and roll
  exposure back if persistence fails.
- Credentials live in the single app config and are managed through Settings,
  never environment variables or an untracked second credential file.

## Client Configuration

StashBase writes durable MCP client configuration only for the bring-your-own
Chat agents: Agent readiness calls `ensureAgentMcp` (Claude Code, Codex), which
regenerates the platform MCP launcher and idempotently rewrites that agent's own
config. OpenQuill injects the same launcher into each private OpenCode
server with the owning window and live-session attribution; it does not write a
user config file.
StashBase config does not mirror client config. Every external client —
including Claude Desktop — is configured by the user from the read-only
Settings → MCP page (standard stdio config, URL access, token, Docker
opt-in); manual and URL setup are documented in
[docs/mcp-configuration.md](../docs/mcp-configuration.md). No route connects
or disconnects a third-party client. An Agent Panel runtime's MCP failure may link to
this page as a manual recovery reference, but retry remains owned by Agent
readiness.

## Permission Boundary

Read, orientation, search, and StashBase-owned reindex work may use the low-risk
approval path. Ordinary `write_file` and `edit_file` may be accepted only by
the built-in panel's explicit Edit policy. Move, delete, commands, network,
sandbox changes, and broader access remain explicit approval decisions.

OpenQuill unbound chats disable native cwd file and command tools because
the project registry is a non-contiguous membership set; every file operation therefore
crosses this MCP authorization boundary. A folder chat may use native local
tools only inside its selected member cwd, with external directories denied.

`create_project` creates a new source folder and changes Project registration.
An Agent Panel runtime call must follow an explicit user request or a visible
approval that names the action and target; exploratory conversation alone is
not consent. The operation returns the resolved project path. Only an
attributable live unbound Chat may rebind to it; folder-bound, stale,
unattributed, and external callers never redirect a built-in session.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Operation Interface | `ProjectOperations` and `createProjectOperations` in `server/project-operations/index.ts` |
| Operation owners | retrieval, project creation, and `server/project-file-mutations.ts` behind that Interface |
| Attributed request scope | `server/project-request-scope.ts`, mounted by `server/routes/project-files.ts` and enforced by `server/project-file-access.ts` |
| Stdio Adapter | `mcp/project-server.ts` and `mcp/server.ts` |
| HTTP client Adapter | `mcp/project-operations-http.ts` |
| HTTP server Adapter | `server/routes/mcp-http.ts` and `server/mcp-http-service.ts` |
| Settings Interface | `server/mcp-http-settings.ts` and the narrow read/HTTP routes in `server/routes/mcp.ts` |
| Launcher and Agent Panel runtime wiring | `ensureAgentMcp` and `ensureMcpLauncher` in `server/agent-mcp.ts`, with per-session OpenCode injection in `server/opencode-runtime.ts` |
| Focused evidence | `server/project-operations/index.test.ts`, `server/routes/project-files.test.ts`, and `server/__tests__/mcp-http-*.test.ts` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:mcp
pnpm test:project-files
pnpm test:retrieval
```

Add `pnpm test:config` for persistence changes. Cover token rotation, malformed
config, Docker bind failure/rollback, concurrent listener transitions, invalid
scope, and built-in/external result parity.

Related journeys: [J05](../design-docs/user-journeys.md#j05-search-and-open-source-evidence),
[J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat),
[J07](../design-docs/user-journeys.md#j07-converge-chat-into-a-document), and
[J08](../design-docs/user-journeys.md#j08-connect-an-external-agent-through-mcp),
plus the [J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop and
[J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project)
conversation-to-project transition.

Related contracts: [File Transactions](file-transactions.md),
[Data Lifecycle](data-lifecycle.md), [Settings and Config](settings-config.md),
and [Agent Runtime](agent-runtime.md).

# Architecture

StashBase is a local IDE for writing. This document owns the product-level
flow, data ownership, and trust boundaries. Detailed process protocols,
transactions, and validation belong to the focused engineering contracts.

## System Shape

```text
Project (an ordinary local folder, possibly empty)
  ├─ Agent Chat: brainstorm, discuss, draft, revise
  ├─ Document Workbench: read, write, inspect, save
  └─ Reference context: prepare → index/search → Agent/MCP
```

The user enters a project and can start discussing an idea before opening a
file or preparing references. Chat and document work share the project without
making the current document implicit Agent context. Drafts and source-linked
wiki pages are ordinary files. Wiki building is one optional Agent task.

Project work, Agent collaboration, file processing, indexing, retrieval, and
writing are implemented. Document-specific diff for fine revision remains
incomplete; current Agent file diffs and save-conflict comparisons are separate
implemented mechanisms. See [Product Direction](product-direction.md).

The desktop application owns user interaction and native window authority. Its
local service coordinates file access, preparation, Agent runtimes, and MCP.
One local daemon owns indexing; each registered folder has an independent
namespace. The included Agent executes locally, with its model requests sent
through the account-backed gateway. Bring-your-own runtimes keep their own
provider authentication and execution boundaries.

## Ownership

| Data or capability | Owner | Rule |
|---|---|---|
| Projects and documents | User | Ordinary local folders and files remain authoritative. |
| Drafts and wiki pages written to files | User | Same file and permission rules as other project content. |
| Conversation history | Agent runtime, adapted by StashBase | History is attributable to its runtime and scope; it is not automatically copied to project files. |
| Unsaved recovery drafts | Local application | Protected recovery state outside projects, not indexed reference material. |
| Extracted text, previews, indexes, checkpoints | Local application and index daemon | Derived state never replaces visible file identity. |
| Agent Instructions | Application settings | One scope's packaged default or customization applies at session mount. |
| Runtime routing policy | Agent adapters | Internal policy is separate from editable user guidance. |
| Runtime-native instruction files | User | StashBase does not create or rewrite `AGENTS.md` or `CLAUDE.md`. |
| Credentials | Local settings and the relevant provider runtime | Provider credentials do not become renderer data or project content. |
| Bug-report drafts | Desktop application | Ephemeral, reviewed application state with explicit handoff. |
| Updates and installation | Desktop application | Native installation and save barriers are not renderer-owned decisions. |

The project registry remembers folders and authorization. It is not a global
library or a shared search scope. Native runtime histories, local configuration,
and derived storage may be shared infrastructure without merging project
content or access.

## Scope And Access

- A project window keeps its folder; another project opens in another window.
  Windows share services while keeping their document and conversation state
  attributable. Project retirement never silently rebinds existing work.
- Built-in Agent file operations use the Chat's bound project. External MCP
  clients select an authorized project explicitly. An unbound internal Chat
  must open or create a project before accessing project files; Welcome does
  not expose that secondary conversation entry.
- Source discovery, retrieval, and file mutations keep the same project
  boundary. Empty results never broaden the namespace or expose derived paths.
- Agent Instructions are working guidance, not access control. A saved change
  applies when a new session mounts; existing sessions retain their resolved
  instructions. Reading or saving this setting does not modify project files.
- The selected runtime and permission mode govern actions and approvals.
  Discussion is not blanket authorization to rewrite or reorganize documents.
- Project entry does not install a runtime, start sign-in, or send a prompt.
  A gated composer keeps the unsent request until the user resolves the stage
  and sends it. The included runtime is packaged; optional extractor components
  follow their separate background installation lifecycle.

See [Window Lifecycle](../code-review/window-lifecycle.md),
[Agent Runtime](../code-review/agent-runtime.md), and
[MCP Access](../code-review/mcp-access.md).

## Preparation And Retrieval

- Direct-text formats use source text. Other admitted formats use current,
  complete prepared representations; previewability alone does not imply
  retrieval or editing capability. The [Documents matrix](design/documents.md#format-capability-matrix)
  owns those distinctions.
- Preparation and semantic indexing are separate. Current prepared text can
  support keyword retrieval independently of the optional meaning-based index.
- Background reconcile and component downloads do not gate project entry or
  discussion unrelated to the pending sources. Stale or partial output is not
  presented as current evidence.
- One daemon owns index state. Configuration changes reconfigure that owner;
  they do not introduce a second index or global retrieval namespace.
- Optional embedding requests may send text to the user's configured provider.
  Account sign-in enables OpenQuill, not search by meaning.

See [Preparation](design/preparation.md), [Search](design/search.md), and
[Data Lifecycle](../code-review/data-lifecycle.md).

## Liveness And Recovery

- Startup establishes ownership of its local service before opening a working
  window. Shutdown drains the shared owners through an explicit handshake.
- Closing a window releases its context after the edit-durability boundary;
  other windows and shared services remain independent.
- Explicit cancellation stays cancelled. Retry and interrupted-work recovery
  follow the owning task's lifecycle, rather than an unbounded global retry.
- Removing a project clears its application-owned state without deleting the
  folder. File deletion is a separate operation with its own authority.
- File mutations keep source identity, version checks, and derived ownership
  consistent. Existing conflict and crash-recovery paths remain part of
  writing even while document-specific diff is unfinished.

See [File Transactions](../code-review/file-transactions.md) and
[Settings and Config](../code-review/settings-config.md). Known limitations in
recovery remain in those contracts and [Documents](design/documents.md).

## Trust Boundaries

- Native registration supplies window authority to local API and Agent
  requests. Renderer-controlled URL fields cannot select another window.
- The renderer uses the local application's allowed endpoints. Gallery index
  and image requests pass through a bounded proxy, not an arbitrary remote
  fetch capability.
- Document content must not acquire application privileges. The current
  executable HTML compatibility exception remains documented in
  [Document Viewers](../code-review/document-viewers.md#trust-boundary).
- External navigation and local-file links use validated paths. Runtime
  commands, network, and file changes follow the selected permission policy.
- Hosted model requests carry necessary model context, not ownership of local
  files, sessions, or tools. Account tokens stay in the local broker boundary.
- Reports freeze the user's reviewed artifacts before an explicit local
  handoff; no automatic submission is implied. See
  [Bug Reporting](../code-review/bug-reporting.md).
- Application updates use the release pipeline's verified artifacts and the
  native save/install boundary. See [Release Pipeline](../code-review/release-pipeline.md).

## Documentation Boundary

Product decisions and observable behavior belong in the area designs.
Engineering contracts own implementation interfaces and validation. A new
product description does not change runtime prompts, permissions, or data
formats; retain truthful current-state limitations until code changes them.

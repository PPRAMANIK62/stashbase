# Architecture

This document records StashBase's high-level system contracts. It explains
what must remain true when implementation changes; source code remains the
source of truth for file, module, route, and function-level detail.

## System Shape

```text
Local files → Convert → Index → Retrieve → MCP → Agents
     ↑                                          │
     └──────────── Agent-written files ─────────┘
```

The Document Workbench is the user-facing surface over local files.
Preparation and Search and Retrieval form the local RAG layer, while the Agent
Panel is the built-in Agent client over the same authorized context.

The desktop application owns file access, user interaction, format
preparation, and the MCP boundary. A local indexing runtime owns chunking,
embedding, storage, and semantic retrieval. Together they operate as one local
library per installation.

## Ownership

| Data | Owner | Rule |
|---|---|---|
| Local files and folders | User | They remain the source of truth. |
| `AGENTS.md` and `CLAUDE.md` | User | They are ordinary visible files and are never overwritten by StashBase. |
| Extracted text, previews, indexes, preparation records | StashBase | They are rebuildable derived state. |
| Application-scoped Agent runtimes | StashBase | They are downloaded on demand into AppData, remain outside the user's PATH, and can be rebuilt without touching provider accounts or global installations. |
| Bug-report drafts | StashBase desktop application | They are ephemeral application state; renderers receive only opaque references and safe display metadata. |
| Credentials and user settings | StashBase settings | They are managed through Settings, not environment variables. Appearance is user-wide, updates every open window immediately, and is limited to theme plus UI and reading-size presets. |

The optional StashBase account session is owned by the local Node service and
stored with the same owner-only configuration as bring-your-own-key
credentials. The Python indexing daemon never receives the Supabase access or
refresh token. It calls an ephemeral loopback broker credential; Node refreshes
the account session and forwards only extracted text to the hosted API.

Derived artifacts must not appear as ordinary files in the workspace. When
search finds derived evidence, the result still identifies and opens the
user-visible source file.

## Scope And Access

- The library is the set of local folders the user has added or opened.
- Each window works primarily in one current folder. Multiple windows may
  show different folders at the same time; those are independent UI scopes,
  not separate libraries or indexing runtimes.
- In-app search defaults to the whole library in either mode. MCP semantic
  retrieval does the same, while MCP keyword retrieval requires an authorized
  folder or path-prefix scope. Both surfaces offer semantic and keyword modes;
  keyword works before AI Index is set up, and source file-type categories
  remain an agent-facing parameter.
- MCP file operations are deliberately bounded to authorized library folders;
  they are never a general filesystem interface. The one membership-changing
  tool, `create_project`, only creates and registers a new folder under the
  default folder home or inside an already-authorized location.
- One local runtime owns indexing state. Other processes communicate through
  its supported boundary rather than maintaining competing copies of the index.
- Agent readiness is demand-driven. An explicit chat action may reuse a
  supported system CLI or install the selected official runtime into AppData;
  opening the app or a folder alone must not download one. Startup repairs MCP
  configuration for cheaply discoverable installed runtimes, and MCP
  configuration is completed again before the built-in Agent session starts.
- Closing a window releases only that window's UI and folder context. Shared
  indexing, settings, and MCP resources remain alive until the application
  session quits. A closed window identity cannot be revived by a request that
  was already in transit when the native window disappeared. Native close
  waits for the renderer to confirm its current edit is durable before
  retiring that identity.

## Preparation And Retrieval

- Directly readable text has three format-specific paths. Markdown source is
  editable and indexed directly. HTML source is readable and indexed through
  its existing in-memory plaintext transformation, without an AppData-derived
  representation. JSON is editable raw source and uses generic-text chunking;
  syntax validity is not an admission gate, and no derived representation,
  note bundle, or link-rewrite behavior is attached to it.
- Other formats may gain a derived representation for Agent reading or search,
  while the original remains the visible file.
- Conversion and semantic indexing are separate stages. A prepared file may be
  available to keyword retrieval before semantic indexing is ready.
- Semantic retrieval is optional. Without embedding configuration, browsing,
  editing, and keyword retrieval remain available.
- AI Index can use either a signed-in StashBase account allowance or a user
  supplied OpenAI/OpenRouter key. The active source is explicit; switching
  rebinds the single local daemon without rebuilding compatible vectors.
- Hosted indexing and meaning-based queries share one token allowance. When it
  is exhausted, hosted semantic work stops while exact text retrieval and all
  other local workflows remain available. Pending semantic work resumes after
  the allowance resets or the user selects an available BYOK source.
- Incomplete, stale, or partial derived output is never current truth.
- Reconcile and reindex bring external file changes back into the library.
- Reconcile estimates new or changed semantic work before embedding. Large
  workloads pause per folder for an explicit decision without delaying folder
  navigation, preparation, editing, or keyword retrieval.

## Liveness And Recovery

- Entering a folder prioritizes a usable workspace; listing, conversion, and
  indexing continue in the background.
- Background work must not make ordinary file browsing depend on preparation.
- Explicit user cancellation is respected; interrupted background work is
  rediscovered when its durable output is incomplete.
- Removing a folder clears StashBase-owned state for that folder without
  deleting the user's source files. Every window showing that folder saves
  first and returns to the library view; restart recovery cannot silently add
  an intentionally removed folder back.
- Application shutdown is an explicit owner-to-server handshake. The server
  drains its cleanup ladder before Electron exits, including on Windows where
  process signals do not provide graceful child termination.
- File mutation and deletion must retire or invalidate related derived state so
  retrieval never presents orphaned or stale evidence as current.
- Import publishes through a no-clobber path; recovery only removes an
  identity-proven partial reservation, never a completed or externally replaced
  destination.
- Closing or failing to open the local index must release the client connection
  and local database server before cleanup returns.

## Trust Boundaries

- Untrusted document content must be rendered without granting it application
  privileges. The current executable-HTML compatibility viewer is a known
  exception tracked in
  [Document Viewers](../code-review/document-viewers.md#trust-boundary).
- External URLs and local-file navigation follow explicit, validated paths.
- Network, commands, deletion, rename, and broader filesystem access remain
  explicit approval decisions in the Agent Panel.
- Bug-report draft lifecycle and any future report artifacts are owned by the
  desktop application. Renderer views can present safe draft metadata but do
  not own artifacts, filesystem access, or privileged actions.

## Documentation Boundary

Update this document when these system contracts, ownership boundaries, or
major flows change. Put user-experience and contribution guidance in the
relevant [design area](README.md). Do not turn either into a source-tree map.

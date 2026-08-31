# Capability Ledger

This ledger is the migration's progress record. It does not replace
[Journey Coverage](../../../code-review/journey-coverage.md), which remains the
canonical evidence map for Shipping behavior.

Use these statuses only:

- **Not assessed** — current behavior and evidence have not been inspected.
- **Specified** — contracts, required results, and current evidence are pinned.
- **Building** — replacement implementation exists but has not passed its gate.
- **Proven** — mapped evidence passes against the replacement.
- **Cut over** — the production renderer uses the proven replacement.
- **Blocked** — a named decision, Interface, or evidence gap prevents progress.

Passing a broad command alone does not make a row Proven. Add links to the
exact tests or release checks that assert the required result as work begins.

Disposition is **Retain**, **Change**, **Remove**, or **Unresolved**. A capability
may split into sub-rows when its observable behaviors have different
dispositions. `Building`, `Proven`, and `Cut over` rows require every field;
docs validation must reject incomplete rows at those statuses.

| Capability | Journeys | Disposition / decision | Owning contracts | Replacement Interface | Compatibility impact | Status | Exact evidence / blocker / deletion condition |
|---|---|---|---|---|---|---|---|
| Bootstrap and onboarding | J01 | Retain / [0002](../decisions/0002-feature-runtime-and-protocol-ownership.md), [0005](../decisions/0005-responsive-electron-runtime.md), [0007](../decisions/0007-failure-recovery-and-test-foundation.md), [0010](../decisions/0010-sandboxed-renderer-and-isolated-build.md) | Renderer Workspace; Settings and Config; Window Lifecycle | `LibraryWelcome` / `LibrarySidebar` → `LibraryApi`; `stashbase.library.chooseFolder`; `GET /api/library`; `POST /api/library/folders/open` | Additive replacement HTTP routes and exact `app://renderer` origin policy; legacy folder routes remain until cutover; renderer receives no window identity | Building | Task 23 first-folder tracer passes component, protocol, server-route, Electron-boundary, and live `app://` smoke evidence listed in [Subphase 2](subphases-2-bootstrap-and-workspace.md#23--authorize-the-first-library-folder). Remaining J01 first-value, Settings, Retrieval, returning-launch, and final journey evidence are deferred to their owning tasks. |
| Library and folders | J02 | Retain / [0002](../decisions/0002-feature-runtime-and-protocol-ownership.md), [0004](../decisions/0004-runtime-scope-shared-identities-and-navigation.md), [0012](../decisions/0012-persistence-commands-and-contract-evidence.md) | Renderer Workspace; File Transactions; Data Lifecycle; Window Lifecycle | `LibrarySnapshot` query key `['library', 'membership']`; validated library HTTP protocol; Electron-owned request authorization | First-folder registration is additive and uses existing server membership authority; legacy folder endpoints stay compatible until cutover | Building | Tasks 23–24 prove settled empty and populated no-active-folder welcome states, complete membership presentation, native open/create and cancellation, classified local failure/retry, selected-folder registration, authoritative active-folder replacement, subsequent-folder addition, and main-owned request identity. Folder-scoped runtime switching, loss/removal, and session restore remain Tasks 25–28. |
| Documents and editing | J03 | Unresolved / — | Markdown Rendering; Document Viewers; File Transactions; Renderer Workspace | — | — | Not assessed | Populate before Phase 3 |
| Preparation | J04 | Unresolved / — | Data Lifecycle; Document Viewers; File Transactions; Settings and Config | — | — | Not assessed | Populate before Phase 4 |
| Search and source navigation | J05 | Unresolved / — | Data Lifecycle; Renderer Workspace; Settings and Config; MCP Access | — | — | Not assessed | Populate before Phase 3 |
| Agent sessions and Chat | J06 | Unresolved / — | Agent Panel; Agent Runtime; MCP Access; Settings and Config | — | — | Not assessed | Populate before Phase 5 |
| Chat-to-document convergence | J07 | Unresolved / — | Agent Panel; MCP Access; File Transactions; Markdown Rendering | — | — | Not assessed | Populate before Phase 5 |
| External Agent access | J08 | Unresolved / — | MCP Access; File Transactions; Data Lifecycle; Settings and Config | — | — | Not assessed | Populate before Phase 6 |
| Bug-report review | J09 | Unresolved / — | Bug Reporting; Window Lifecycle; Architecture | — | — | Not assessed | Populate before Phase 6 |
| Durable core loop | J10 | Unresolved / — | Renderer Workspace; Data Lifecycle; Agent Runtime; Agent Panel; MCP Access; File Transactions; Markdown Rendering | — | — | Not assessed | Populate before Phase 6 |
| Conversation to project | J11 | Unresolved / — | Renderer Workspace; Settings and Config; MCP Access; Agent Runtime; Agent Panel; File Transactions; Data Lifecycle | — | — | Not assessed | Populate before Phase 6 |

## Cross-Cutting Gates

| Gate | Status | Evidence / decision |
|---|---|---|
| Dependency boundaries | Proven | `pnpm test:renderer-architecture` proves graph direction, cycles, feature isolation, layer APIs, legacy isolation, and wire-schema registration against the replacement graph. |
| Runtime contract validation | Building | Shared Zod schemas now cover the library folder dialog, uncredentialed renderer runtime configuration, and library HTTP request, snapshot, and failure envelopes. `pnpm test:protocols`, `pnpm test:electron-boundary`, server route/origin tests, renderer adapter tests, and the live `app://` smoke prove these entries; remaining HTTP, IPC, event, WebSocket, worker, and persisted protocols arrive with their owning slices. |
| Accessibility and keyboard operation | Not assessed | Map rendered and E2E evidence |
| Theme, scaling, reduced motion | Building | Decision 0015 adopts Fluid Functionalism and its Base UI flavors. `renderer/src/app/providers.tsx` mounts the Fluid shape, size, surface, icon, tooltip, and reduced-motion providers; `renderer/src/globals.css` and the bundled Inter Variable font carry the production theme. Typecheck and build prove integration only. Representative theme, shape, size, focus, motion, and final product visual evidence remain Tasks 12–16. |
| Initial JavaScript and lazy entries | Not assessed | Record isolated replacement baseline in Phase 0 |
| Startup and interaction performance | Not assessed | Record measurement method in Phase 0 |
| Electron titlebar and window lifecycle | Building | `pnpm test:electron-boundary` and `env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke` prove the replacement `app://` origin, production CSP, sandboxed typed preload, window/frame/origin/capability/payload authorization, and default-deny window policy. The legacy renderer save/update handshake is removed; reload stays blocked and a typed save barrier returns with the document slice, before editable state exists. Full replacement lifecycle and final journey evidence remain deferred. |
| Privacy and credential boundary | Not assessed | Map Settings, Agent, MCP, and bug-report evidence |

## Update Rule

Every migration PR updates only the rows it changes. A row moves to Proven
only when its focused evidence runs against the replacement entry. Record an
unresolved requirement as a gap with its owning contract; do not soften the
requirement or describe incomplete behavior as parity.

Any temporary compatibility adapter is named in the final column with its owner
and deletion condition. A changed or removed behavior links its approved
decision; confidence or a broad command is never a substitute for exact
evidence.

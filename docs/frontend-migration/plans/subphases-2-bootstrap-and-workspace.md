# Subphase 2 — Bootstrap and Workspace

## 23 — Authorize the first library folder

**Blocked by:** 19.

**Status:** Complete.

Deliver the first J01 onboarding tracer bullet: distinguish unresolved library
membership from a settled no-folder state, welcome the user in the workspace,
let them open an ordinary local folder or create one through the authorized
native dialog, register and open it through a validated server Interface, and
keep the shell usable with local loading and retry. Do not introduce a global
bootstrap gate or claim the complete J01 first-value and returning-launch
outcome before its later Workspace, Settings, Retrieval, and Agent slices
exist.

The Files sidebar now queries validated library membership without presenting
a false empty state while the request is unresolved. Any settled window without
an active folder presents one quiet workspace welcome: the StashBase mark,
product name, and local-files promise lead into explicit Open folder and Create
folder onboarding actions. Create starts the native picker at the user's home
and uses its directory-creation capability. Known members awaiting Task 24 are
not misrepresented as active. Cancellation stays quiet, failure and retry
remain local, and a successful server response replaces the welcome with the
Agent workspace while the sidebar shows the authoritative active-folder name.
The app composition root constructs the query, HTTP, and native-dialog adapters.
Electron authorizes exact-origin main frame requests from registered windows
and injects the main-owned window identity on `/api/*`, so neither renderer code
nor preload receives it. The server recognizes the exact packaged renderer
origin without wildcarding and validates the additive replacement library
routes; the legacy folder routes remain available until cutover.

Evidence: `pnpm test:protocols`, `pnpm test:electron-boundary`,
`pnpm test:renderer`, `pnpm test:renderer-architecture`,
`node --import tsx --test server/middleware/renderer-origin.test.ts server/routes/library.test.ts`,
`pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`, and
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`.

## 24 — List and add library folders

**Blocked by:** 23.

Render the complete library membership list through the scoped query and add
subsequent folders through the same authoritative, validated operation.

## 25 — Open and switch active-folder runtimes

**Blocked by:** 24.

Create and dispose folder-scoped Workspace runtimes with cancellation,
generation guards, query ownership, and stale-completion rejection.

## 26 — Render the accessible file tree

**Blocked by:** 25.

Use one visible-tree model for order, semantics, keyboard navigation, restricted
entries, and bounded large-folder rendering.

## 27 — Handle folder loss and removal

**Blocked by:** 25, 26.

Preserve save safety and unrelated work while reconciling removal across
windows, retiring the affected runtime, and evicting its scoped queries.

## 28 — Restore approved workspace session state

**Blocked by:** 25.

Restore versioned folder and tab identities, pane geometry, and safe view
preferences without persisting query state, pending commands, or private data.

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
and uses its directory-creation capability. Known members are not
misrepresented as active; Task 24 presents them as explicit choices.
Cancellation stays quiet, failure and retry remain local, and a successful
server response replaces the welcome with the Agent workspace while the
sidebar shows the authoritative active-folder name.
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

**Status:** Complete.

Render the complete library membership list through the scoped query and add
subsequent folders through the same authoritative, validated operation.

A settled window with known members and no active folder now presents every
member as a choice in the welcome workspace. Once a folder is active, its one
sidebar row opens a compact chooser containing the complete authoritative
membership plus Open folder and Create folder actions; the sidebar never
renders multiple folder trees. Duplicate basenames gain their shortened path
inside the chooser, while the welcome list always shows the shortened path.
Choosing a known member or authorizing another local folder replaces the
scoped membership query with the server response. Cancellation remains quiet,
operations disable competing choices, and classified failures stay beside the
surface that initiated them. This task changes the window's selected
membership only; Task 25 still owns folder-scoped runtime creation, disposal,
generation guards, and stale-completion rejection.

Evidence: `pnpm test:renderer`, `pnpm test:protocols`, `pnpm typecheck`,
`pnpm lint:web`, `pnpm build:web`, and
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`.

## 25 — Open and switch active-folder runtimes

**Blocked by:** 24.

**Status:** Complete.

Create and dispose folder-scoped Workspace runtimes with cancellation,
generation guards, query ownership, and stale-completion rejection.

App composition now projects the authoritative active folder from the window's
library query and constructs exactly one folder-scoped `WorkspaceRuntime` when
that identity settles. Each runtime owns an immutable folder-plus-generation
scope, a Zustand vanilla store, a runtime abort signal, guarded completion, and
idempotent disposal. The app composition root invokes the Workspace lifecycle
hook; no provider or global store exists before a consumer needs one. A
successful switch disposes the prior scope before mounting the replacement; a
pending, cancelled, or failed switch leaves the current runtime intact.
Reopening a folder receives a fresh window-local generation.

Folder commands now pair cancellation with operation generations, so an older
response cannot replace the membership query after a newer choice wins. Runtime
completion also requires the captured folder identity and generation to remain
current. Workspace owns a typed folder query prefix; disposal cancels only that
folder's in-flight queries while retaining bounded cached data for ordinary
navigation. Library membership and other folders remain untouched. Task 26
consumes this scope for listing and tree state; Task 27 owns loss/removal
eviction rather than treating an ordinary switch as authorization loss.

Evidence: `pnpm test:renderer`, `pnpm test:renderer-architecture`,
`pnpm format:web`, `pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`, and
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`.

## 26 — Render the accessible file tree

**Blocked by:** 25.

**Status:** Complete.

Use one visible-tree model for order, semantics, keyboard navigation, restricted
entries, and bounded large-folder rendering.

The active `WorkspaceRuntime` now owns serializable expansion and selection
state while TanStack Query owns the folder-explicit listing. A shared strict
schema validates the server producer and renderer adapter before the feature
maps the wire response into folder-scoped domain values. The pure tree model
builds implied parents, sorts folders before files with natural names, and
produces the sole visible-row order consumed by rendering, ARIA position, and
keyboard movement. Collapsed descendants do not enter that model.

The Files sidebar exposes one roving tab stop and supports Up, Down, Home, End,
Right, and Left navigation plus Enter/Space activation. Excluded and unreadable
folders, symlinks, special entries, cloud placeholders, and unreadable files
remain visible but reveal in the platform file manager instead of expanding or
opening. Generic regular files remain selectable and state that Search and
automatic Chat context exclude them. Loading, empty, error, retry, and reveal
failure stay local to Files. Large visible trees initially render 240 rows and
extend in 240-row pages while preserving positions from the same complete
visible model. Tree rows and pagination compose the shared compact Button
primitive, retaining tree-owned ARIA and keyboard semantics without importing
the Sidebar Menu's wrapping navigation or per-row overlay measurement.
Restrained monochrome file-format glyphs carry recognition without adding
another header. Quiet ancestor rails and a wider child offset make nesting
legible without changing the compact row scale. A single Fluid proximity-hover
layer travels across visible rows while selected backgrounds and tree-owned
focus behavior remain distinct. Opening selected documents remains with the
document-runtime tasks; folder loss/removal and restored expansion/selection
remain Tasks 27–28.

Evidence: `renderer/src/features/workspace/domain/tree.test.ts`,
`renderer/src/features/workspace/domain/workspace.test.ts`,
`renderer/src/features/workspace/infrastructure/files-api.test.ts`,
`renderer/src/features/workspace/ui/file-tree.test.tsx`,
`renderer/src/platform/electron/file-manager.test.ts`, and
`shared/protocols/http/files.test.ts`; `pnpm test:library-files`,
`node --import tsx --test server/files.test.ts`, `pnpm test:protocols`,
`pnpm test:renderer`, `pnpm typecheck`, `pnpm format:web`,
`pnpm lint:web`, `pnpm build:web`, and
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`.

## 27 — Handle folder loss and removal

**Blocked by:** 25, 26.

Preserve save safety and unrelated work while reconciling removal across
windows, retiring the affected runtime, and evicting its scoped queries.

**Status:** Complete.

Each folder in the active-folder chooser now has a quiet trailing removal icon;
the row also exposes the action with an accessible name and Delete shortcut.
The action and confirmation compose the shared MenuItem, Dialog, and Button
primitives. Confirmation shows the complete home-shortened path, keeps the
operation locked while it is pending, reports a local retryable failure, and
states that only Library membership, prepared data, and indexed data are
removed; the source folder and its files stay on disk. The additive validated
removal route returns the authoritative post-removal `LibrarySnapshot`, reuses
the existing folder cleanup transaction, removes membership last, and can
forget a configured folder after its source has moved or disappeared.

A typed, authorized Electron lifecycle boundary records each window's active
folder and coordinates a correlated release request across every affected
window before removal. Missing, failed, stale, or timed-out acknowledgements
stop the command. The current workspace has no editable document state and
therefore acknowledges release; Task 32 composes the document save barrier into
this seam before editable state ships. Successful removal is broadcast only as
a hint: each renderer refetches authoritative membership before retiring a
scope, so stale or forged notifications cannot remove unrelated work.

Direct folder loss and the files route's typed unavailable response share the
same recovery path. Recovery captures the exact runtime and generation, rejects
stale completions, rebinds a folder that remains authorized, and otherwise
retires only the lost runtime while cancelling and removing only its query
prefix. Ordinary folder switching still retains its bounded cache, and
unrelated folder state remains intact.

Evidence: `renderer/src/features/workspace/application/remove-folder.test.ts`,
`renderer/src/features/workspace/hooks/use-library-lifecycle.test.ts`,
`renderer/src/features/workspace/ui/sidebar.test.tsx`,
`electron/library/lifecycle.test.cjs`, `electron/library/preload.test.cjs`,
`server/routes/library.test.ts`, and the shared Electron/HTTP protocol tests;
`pnpm test:renderer`, `pnpm test:electron`, `pnpm test:electron-boundary`,
`pnpm test:library-files`, `pnpm test:conversion-scheduler`,
`pnpm test:protocols`, `pnpm typecheck`, `pnpm format:web`, `pnpm lint:web`,
`pnpm build:web`, and
`env -u ELECTRON_RUN_AS_NODE pnpm test:electron-boundary:smoke`.

## 28 — Restore approved workspace session state

**Blocked by:** 25.

Restore versioned folder and tab identities, pane geometry, and safe view
preferences without persisting query state, pending commands, or private data.

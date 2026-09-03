# Subphase 3 — Documents

## 29 — Create document-tab runtimes

**Blocked by:** 25.

**Status:** Complete.

Own unique source identity, activation, cancellation, disposal, and stale-open
rejection in independently scoped document runtimes.

The new `documents` feature owns folder-plus-path source identity, unique tabs,
fresh restored runtimes, cancellation, disposal, and stale-completion guards.
App composition connects eligible file-tree activation and Workspace session
projection; restricted entries remain reveal-only. The Fluid titlebar tab
surface supports keyboard activation and close while Task 30 retains source
loading.

Evidence: focused Documents, app-composition, file-tree, session, and shell
tests; `pnpm test:renderer`, `pnpm test:renderer-architecture`,
`pnpm typecheck`, `pnpm format:web`, `pnpm lint:web`, `pnpm build:web`, and the
replacement Electron smoke.

## 30 — Load Markdown and TXT sources

**Blocked by:** 29.

**Status:** Complete.

Load versioned source bytes with encoding, in-folder editing, out-of-folder
read-only, and retryable-failure rules intact.

Documents now validates and loads explicitly folder-scoped Markdown and TXT
source with versioned query ownership. Active-folder sources retain edit
eligibility; cross-folder and unsupported-encoding sources stay read-only.
Closing or retiring a document cancels and removes its source query, while
failed opens remain in place with Retry.

Evidence: focused protocol, adapter, query, runtime, and component tests;
`pnpm test:protocols`, `node --import tsx --test server/files.test.ts`,
`pnpm test:renderer`, `pnpm test:renderer-architecture`, `pnpm typecheck`,
`pnpm format:web`, `pnpm lint:web`, `pnpm build:web`, and the replacement
Electron smoke.

## 31 — Save text through the version authority

**Blocked by:** 30.

**Status:** Complete.

Active-folder Markdown and TXT now keep a live versioned draft and autosave
through the shared source authority. Saves retain byte conventions, reconcile
the returned source/version without overwriting newer typing, and leave failed
or conflicting drafts recoverable; ordinary failures expose compact retry
feedback.

Evidence: focused protocol, save-adapter, document-domain/runtime, source UI,
HTTP-client, and server save tests; `pnpm test:protocols`,
`node --import tsx --test server/files.test.ts`, `pnpm test:renderer`,
`pnpm test:renderer-architecture`, `pnpm typecheck`, `pnpm format:web`,
`pnpm lint:web`, and `pnpm build:web`.

## 32 — Enforce save barriers during navigation and close

**Blocked by:** 19, 31.

**Status:** Complete.

Tab open, activation, and close plus folder change, removal, reload, and native
window close now await one serialized live-document flush. A failed save blocks
the transition and retains the mounted draft; typed correlated Electron
requests exclude competing close and reload actions.

Evidence: focused document-runtime, tab UI, folder-transition, lifecycle,
protocol, preload, Electron coordinator, and replacement bridge tests;
`pnpm test:protocols`, `pnpm test:renderer`, `pnpm test:electron-boundary`,
`pnpm typecheck`, `pnpm format:web`, `pnpm lint:web`, and `pnpm build:web`.

## 33 — Resolve external-write conflicts

**Blocked by:** 31, 32.

**Status:** Complete.

External-write conflicts retain one disk snapshot beside the latest editor
draft. Reload, merge, and explicit overwrite share one exclusive decision
owner; unresolved or failed decisions keep navigation behind the save barrier.

Evidence: focused source protocol/adapter, document domain/runtime, conflict
comparison, and source UI tests; `pnpm test:protocols`, `pnpm test:renderer`,
`pnpm typecheck`, `pnpm format:web`, `pnpm lint:web`, and `pnpm build:web`.

## 34 — Integrate Milkdown Writer and Reading modes

**Blocked by:** 30, 31.

**Status:** Complete.

Markdown now uses one lazy Milkdown surface for Writer and Reading modes.
Mode changes retain editor state, scoped styles consume app tokens, and only
the five most-recent Markdown surfaces stay mounted. The Markdown bridge
inherits the inset workspace plane instead of repainting the lower sidebar
surface, while Milkdown anatomy maps its canvas to `surface-2` and reserves
higher surfaces for floating controls.

Evidence: focused Markdown lifecycle, serialization, mode, retention, and UI
tests; renderer tests, architecture checks, typecheck, lint, and web build.

## 35 — Add Find, outline, anchors, and file links

**Blocked by:** 34.

**Status:** Complete.

Add document navigation and safe link behavior through the same source identity
and active-tab authority.

The active document now owns one scoped navigation runtime for Find, live
Markdown outline, and pending anchors. Find supports case and whole-word
matching plus forward/reverse keyboard traversal; headings retain stable
duplicate-aware anchors and re-resolve against the live Milkdown document.
App composition owns the window-level Find commands, while each visible control
subscribes only to its narrow navigation-state slice. Markdown-specific DOM
controllers and adapters remain colocated with the lazy Markdown surface. The
Find toolbar composes the Fluid `InputGroup` and `Button` size ladder; outline
disclosure, rows, hierarchy, focus, and motion come from the Fluid
`SidebarGroup` and `SidebarMenu` families. App composition presents Files and
the active Markdown outline as icon-only modes in one compact Fluid
`TabsSubtle` control centered below the folder selector; tooltips and accessible
names keep both modes explicit. Switching replaces the scrollable navigator
body without remounting the file tree. The outline identifies its active
document, shows its heading count, and uses submenu rails to express hierarchy;
the mode switch remains stable for every open document, with distinct messages
for formats without outline support and Markdown documents without headings.
Relative file links preserve their owning folder and open through the existing
tab/save-barrier workflow, while same-document anchors scroll in place and
credential-free HTTP(S) links use a validated, capability-authorized Electron
bridge. Unsafe, malformed, root-escaping, and browser-navigation links are
rejected.

Evidence: focused navigation-domain/runtime, Markdown Find/outline/source,
tab-workflow, external-navigation protocol/preload/handler, renderer-adapter,
and bridge tests; `pnpm test:protocols`, `pnpm test:electron-boundary`,
`pnpm test:renderer`, `pnpm test:renderer-architecture`, `pnpm typecheck`,
`pnpm format:web`, `pnpm lint:web`, `pnpm build:web`, and the replacement
Electron smoke.

## 36 — Add source-preserving JSON editing

**Blocked by:** 31.

Provide Tree and Source modes, malformed fallback, minimal source patches, and
the shared versioned save path without a second document model.

## 37 — Add generic text and code preview

**Blocked by:** 29.

Perform bounded strict UTF-8 inspection with syntax-aware reading and truthful
binary, oversized, unavailable, and restricted states.

## 38 — Add PDF and image viewers

**Blocked by:** 16, 29.

Provide lazy accessible previews and lightbox behavior with version-keyed,
bounded resources and explicit cleanup.

## 39 — Add DOCX and HTML viewers

**Blocked by:** 19, 29.

Provide sanitized DOCX preview/fallback and separately sandboxed HTML
compatibility rendering without widening shell privileges.

## 40 — Add audio and video viewers

**Blocked by:** 16, 29.

Provide lazy playback, compatibility fallback, transcript evidence, and cleanup
of media handles and background work.

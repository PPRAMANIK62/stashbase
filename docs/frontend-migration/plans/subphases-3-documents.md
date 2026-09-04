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

The active document now owns Find, Markdown outline, anchors, and safe link
navigation. A compact icon switch keeps Files and the format-aware outline in
one stable sidebar location, including when no document is open. Relative links
reuse the tab and save-barrier workflow, same-document anchors scroll in place,
and validated HTTP(S) links open through the authorized Electron bridge.

Evidence: focused navigation-domain/runtime, Markdown Find/outline/source,
tab-workflow, external-navigation boundary, and renderer tests; protocol,
typecheck, lint, build, architecture, and replacement Electron smoke checks.

## 36 — Add source-preserving JSON editing

**Blocked by:** 31.

**Status:** Complete.

Bounded strict JSON opens synchronized Preview and Source panes over one
source-authoritative save path. The shared Table supports in-place structural
edits by patching owned source spans, preserving surrounding formatting; plain
text additions become strings while explicit JSON retains its type. Malformed,
duplicate-key, and bounded-out content remains editable in Source with an
actionable reason, and document Find follows the focused pane.

Evidence: focused JSON source-model, editor, tree-Find, runtime, renderer,
protocol, server-route, and save-boundary tests; typecheck, format, lint,
architecture, and web build checks.

## 37 — Add generic text and code preview

**Blocked by:** 29.

**Status:** Complete.

Generic files now use a separate bounded preview query that cannot save or
widen retrieval access. TXT and strict UTF-8 generic text share one lazy
CodeMirror editor; TXT stays literal while generic code loads a filename-matched
grammar. Refusal states retain source identity, metadata, and folder-scoped
Reveal recovery, while unavailable inspections can retry in place.

Evidence: focused preview protocol/adapter/domain, shared editor, document UI,
query lifecycle, workspace Reveal request and cross-folder route, server
inspection, renderer, architecture, typecheck, lint, and web build checks.

## 38 — Add PDF and image viewers

**Blocked by:** 16, 29.

**Status:** Complete.

PDF and supported images now resolve through folder-scoped, versioned asset
references before their viewer code loads. PDF keeps page and Find state while
bounding nearby canvas/text-layer work; shared floating controls provide
in-place page and zoom entry, image fitting, and an accessible lightbox.
Replaced or closed resources cancel stale work and release viewer-owned handles.

Evidence: focused asset adapter and server-route authorization, viewer dispatch,
PDF lifecycle, PDF Find, image controls, lightbox, and document runtime tests;
renderer, architecture, typecheck, lint, and web build checks.

## 39 — Add DOCX and HTML viewers

**Blocked by:** 19, 29.

**Status:** Complete.

DOCX now converts source bytes in a bounded Worker, sanitizes the result, and
falls back to the prepared HTML asset when direct conversion fails. HTML uses
a separately sandboxed, folder-scoped compatibility frame. An inset preview
surface and bounded theme messages align its scrollbar with the app; both
viewers retain Find, navigation, and source identity without widening shell
access.

Evidence: focused asset, DOCX conversion/sanitization, HTML frame/navigation,
server bootstrap, CSP, and document UI tests; renderer, architecture,
typecheck, lint, and web build checks.

## 40 — Add audio and video viewers

**Blocked by:** 16, 29.

**Status:** Complete.

Audio and video now use lazy native playback with Strict Mode-safe resource
ownership and an abortable compatible-audio fallback. The renderer origin
exposes the source-version header required to open binary assets. A
source-versioned transcript surface follows preparation state, supports
timestamp seeking and Find, and releases media and request work with the
document.

Evidence: focused media protocol, adapter, format, playback, fallback,
transcript, Find, cleanup, and document UI tests; renderer architecture,
typecheck, lint, and web build checks.

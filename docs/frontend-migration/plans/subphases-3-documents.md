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

Load versioned source bytes with encoding, in-folder editing, out-of-folder
read-only, and retryable-failure rules intact.

## 31 — Save text through the version authority

**Blocked by:** 30.

Preserve live dirty authority, expected versions, no-op saves, byte conventions,
pending feedback, and authoritative reconciliation.

## 32 — Enforce save barriers during navigation and close

**Blocked by:** 19, 31.

Route tab, folder, reload, and native-window transitions through the current
editor save barrier without discarding recoverable buffers.

## 33 — Resolve external-write conflicts

**Blocked by:** 31, 32.

Offer reload, overwrite, and merge with both versions recoverable and competing
resolution actions excluded until the current decision settles.

## 34 — Integrate Milkdown Writer and Reading modes

**Blocked by:** 30, 31.

Provide lazy tokenized Milkdown modes with permitted third-party CSS overrides,
selection continuity, and bounded editor resources.

## 35 — Add Find, outline, anchors, and file links

**Blocked by:** 34.

Add document navigation and safe link behavior through the same source identity
and active-tab authority.

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

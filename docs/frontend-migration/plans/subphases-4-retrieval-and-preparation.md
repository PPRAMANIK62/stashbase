# Subphase 4 — Retrieval and Preparation

## 41 — Implement Quick Open

**Blocked by:** 26, 29.

**Status:** Complete.

Cmd/Ctrl+P now opens a lazy, titleless active-folder document picker with dense
file rows, shared proximity selection, complete keyboard navigation, focus
restoration, and truthful generic/restricted-file treatment. It emits typed
open or Reveal intents that app composition resolves through existing workspace
and document authorities; Cmd/Ctrl+O remains unassigned.

Evidence: focused ranking, picker interaction, scope retirement, app
composition, document-open, Reveal, renderer architecture, typecheck, lint, and
web build checks.

## 42 — Implement exact library search

**Blocked by:** 26, 29.

**Status:** Complete.

Cmd/Ctrl+Shift+F always focuses the sidebar Search field. Exact queries default
to the active folder, can widen to the library, cancel obsolete work, group
individual occurrences by source, and reveal the selected occurrence after its
active- or out-of-folder document viewer is ready.

Evidence: focused protocol, adapter, scope, cancellation, keyboard/focus,
occurrence navigation, app-composition, read-only, architecture, typecheck,
lint, and web build checks.

## 43 — Present Preparation status and recovery

**Blocked by:** 26, 38, 39, 40.

Show current, stale, pending, and failed derived state without blocking ordinary
browsing or confusing Preparation with AI Index readiness.

## 44 — Implement Preparation controls

**Blocked by:** 43.

Provide explicit preparation and capture actions, progress, cancellation,
localized recovery, and hidden-derived-note guarantees.

## 45 — Implement semantic retrieval

**Blocked by:** 42, 44.

Provide scoped AI Index readiness and semantic results with cancellation,
source evidence, stable identities, and truthful unavailable states.

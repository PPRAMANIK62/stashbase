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

Cmd/Ctrl+Shift+F always focuses the sidebar Search field. Exact queries are
bound to the selected Library folder, cancel obsolete work, reject any
out-of-folder result returned by the boundary, group individual occurrences by
source, and reveal the selected occurrence after its document viewer is ready.

Evidence: focused protocol, adapter, selected-workspace filtering,
cancellation, keyboard/focus, occurrence navigation, app-composition,
architecture, typecheck, lint, and web build checks.

## 43 — Present Preparation status and recovery

**Blocked by:** 26, 38, 39, 40.

**Status:** Complete.

Research: [Preparation and semantic retrieval research](../research/preparation-and-retrieval-tasks-43-45.md).

One folder-explicit status query polls preparation and AI Index state at 1.5 s
while work moves and 8 s idle, nested under the workspace folder key so folder
retirement drops it. A pure readiness projection marks failed, cancelled, and
blocked tree rows and a folder attention cue; pending stays quiet in the tree
and appears only in PDF, image, and DOCX status lines and the search readiness
line. Stale output reappears as pending. The status change counter refreshes
the file listing after external writes. AI Index fields travel in the same
snapshot but render only in Task 45.

Evidence: focused protocol, readiness projection, status adapter, polling,
tree marker, sidebar cue, viewer slot, search line, app composition,
architecture, typecheck, lint, and web build checks.

## 44 — Implement Preparation controls

**Blocked by:** 43.

**Status:** Complete.

Research: [Preparation and semantic retrieval research](../research/preparation-and-retrieval-tasks-43-45.md).

Reprocess and Cancel sit inline where a state is shown: viewer status lines
and a tree context menu on failed or cancelled rows. Actions refetch status
instead of predicting it. DOCX and media prepare on open. A blocked
transcription runtime renders the server reason with Open Settings; the
Transcription and General Settings sections are live. Clipboard capture
returns as a typed Electron capability: a fail-closed main-side monitor that
re-reads the durable opt-in, offers only while a window is focused and no
Agent composer owns focus, and an "Add image to StashBase?" dialog that
imports through the ordinary upload path. A legacy derived-note failure
record resolves to its visible source; no derived path is rendered.

Evidence: focused control protocol and adapter, action hook, status line,
context menu, capture protocol, preload, monitor, offer dialog, upload
adapter, Settings panel, Electron boundary, typecheck, lint, and web build
checks.

## 45 — Implement semantic retrieval

**Blocked by:** 42, 44.

**Status:** Complete.

Research: [Preparation and semantic retrieval research](../research/preparation-and-retrieval-tasks-43-45.md).

Library semantic hits now carry their owning folder and relative path from
the server, so the renderer never splits paths against roots. One search
surface offers Exact and Similar modes, both scoped to the selected folder;
the whole-library scope picker was removed on 2026-09-09 by product decision,
and the domain grouping keeps the library shape should it return. Semantic
requests carry a real abort
signal and run only when the Task 43 readiness projection allows; each
unavailable, awaiting, paused, indexing, and failed state has its own copy
and Exact stays usable in all of them. The AI Index notice, index-warning
recovery, and the AI Index Settings section (hosted account, allowance, sign
in and out, own key, explicit source) are live. Credentials stay server-side.

Evidence: focused server identity, semantic and embedder protocols, adapters,
readiness projection, grouping and navigation intent, mode UI,
Settings panel, retrieval and library-files server suites, typecheck, lint,
and web build checks.

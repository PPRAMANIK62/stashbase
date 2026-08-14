# Bug Reporting & Privacy

Bug reporting should make a local failure actionable without turning StashBase
into a telemetry product. The user chooses when to begin a report, sees what
would be shared, and remains the only party who submits information outside
the application.

## Product Contract

* Reporting begins from a deliberate user action: the sidebar's Report Bug
  button, or the native **Help → Report a Bug…** entry that remains reachable
  when the main workspace renderer is unhealthy.

* Report preparation is local. It does not require a GitHub account, OAuth,
  a GitHub token, a hosted service, or automatic network submission.

* The application owns report drafts and any future report artifacts. They are
  not workspace files, are not indexed, and never appear in the file tree or
  search results.

* Renderer views are presentation only. They may show a safe description of a
  draft, request bounded preview data, and request lifecycle actions, but they
  do not own artifacts, filesystem locations, privileged operations, or
  authoritative draft state.

* Preview and selection are separate operations. Inspecting or expanding an
  artifact preview never includes it. Only an explicit include or exclude
  request changes the main-process-owned selection.

* A report must be reviewed before any future sharing action. Redaction is a
  defence in depth measure, never a replacement for informed user review.

* Approval is the security cut line between mutable review state and every
  later outcome. Artifact generation must consume the exact approved snapshot;
  it must never recollect inputs or read mutable review selections.

* Final artifact creation, attachment, retention, and cleanup are
  main-process responsibilities. The renderer can approve a reviewed
  configuration, but it cannot create an attachment or choose its contents.

## Current: Local Review And Approval

Selecting **Report a Bug…** creates an in-memory draft through the Electron
main process. Draft creation attempts to capture the selected StashBase
window, collect the fixed diagnostics allowlist, and read at most the final
32 KiB of the application log. A tail that starts mid-line drops that partial
line before the text is sanitized and independently scanned. Collection
failures leave the individual resource unavailable rather than failing the
whole draft.

A dedicated local review window is one short form. It always presents as a
dialog-sized window over the application — including over a full-screen
window, where it joins that space rather than opening a separate desktop — and
never becomes a full-screen surface itself. It leads with one problem
description whose guidance asks for the expected outcome only when it is not
obvious, and optional reproduction steps stay collapsed until the user chooses
to add them, automatically expanding when saved content exists. Below the
description, a compact attachment checklist shows each artifact as a single
row: an explicit include control whose checked state comes from the main
process, the artifact name, and one line of size, dimension, truncation, and
redaction metadata. Collection and processing narration stays off the form; an
unavailable artifact keeps its row with a disabled, unchecked control.
Artifact previews are collapsed by default and open on demand; expanding a
preview never changes the selection. The checklist itself is the selection
display and sits directly above the final review action.

The log preview shows the exact sanitized text retained by the main process
for approval from that bounded tail. Size, redaction count, truncation status,
and availability remain visible as checklist-row metadata. The text is
read-only, collapsible, selectable, and vertically scrollable; the original
unredacted log never reaches the review renderer.

The screenshot preview and prepared attachment use the same captured lossless
PNG bytes retained for approval. They are not resized, recompressed, converted
to another format, or independently recaptured. The UI
fits the complete uncropped image while preserving its aspect ratio, supports
wheel and pinch zoom, and provides explicit full-size and fit-to-view controls
so small text remains inspectable without trapping the image outside the
viewport. Capture is bounded to 16 MiB and 16,384 pixels per edge; a capture
outside those limits is unavailable rather than replaced with an approximate
artifact.

Opening review is not approval. The lifecycle advances from collection to a
reviewable draft, transfers authority to the review window, accepts only
validated field and artifact-selection operations, and reaches `APPROVED`
only after the user presses **Prepare Report**. This user-facing preparation
action is the internal approval cut line: it freezes the selected
configuration locally and sets deselected resources aside, out of every
approved view, until the review closes. The main process then claims that
exact snapshot, creates only its selected artifacts in the current session's
temporary report area, and shows a **Report ready** handoff in the same
window. Nothing is uploaded or submitted automatically. The handoff screen is
the report's destination hub, one explicit action per destination. The GitHub
action copies the prepared files into a new, uniquely named folder inside the
user's Downloads folder and opens a prefilled issue for the user to attach
them to — the familiar browser-upload path, with no window the user must
notice. One approval keeps one Downloads folder; retries heal it rather than
accumulating copies. A separate Download action saves the same files to that
folder without opening GitHub. The user may instead go back: an
explicit Back action returns the draft to its
mutable reviewing state, restores the set-aside checklist rows, and discards
the approved snapshot and pending handoff, so a later Prepare Report performs
a fresh privacy scan and captures a new snapshot.

The current service creates a logically immutable, main-process-private
approval snapshot containing validated user text and only the selected,
available resources. Repeated approval and preparation use the same snapshot,
and no review operation can mutate the draft afterward. Claiming it for the
handoff gives the in-progress operation its own immutable input, so closing the
review cannot invalidate work already underway.

Prepared output is a session-scoped handoff, not a new source of truth or
report history. The application clears the bug-report temporary root on the
next boot, writes selected artifacts with fixed names, and never returns its
path to the renderer. The Downloads copy and a user-saved copy are durable
user files outside that temporary root and are not affected by next-boot
cleanup. The opened GitHub page contains only the
three reviewed report sections: Problem, optional Steps to reproduce, and
Environment, with the approved diagnostics allowlist in the Environment
section when included. Logs, screenshot bytes, internal identifiers, and
filesystem paths are never placed in the URL.

The main process retains the authoritative screenshot bytes and sanitized log
text. The review model carries metadata only; the bound review renderer can
request one artifact by its opaque reference and receives either the exact
sanitized bounded log excerpt or a size-bounded lossless PNG data URL with its
original dimensions. The renderer never receives the main-private screenshot
`Buffer`, the original unredacted log, paths, handles, source-window identities,
environment data, arbitrary diagnostic properties, raw collection objects, or
mutable records.

The responsibility boundary is:

```text
Main process
    ↓ retrieve the authorized artifact
    ↓ sanitize and bound it
    ↓ return only safe preview data for an opaque artifact reference
Bound review renderer
    ↓ display read-only preview data
    ↓ request an explicit include or exclude action
Main process
    ↓ update authoritative selection
    ↓ freeze selected resources on approval
    ↓ create and attach any future final artifact
```

Preview data is a representation of the resource eligible for approval, not a
second source of truth. Future artifact preparation must use the approved
main-owned resource rather than renderer state or returned preview data.

## Ownership And Access

The desktop application creates a draft from the current native window. The
source window identity is derived in the main process, not supplied by a
renderer. A draft identifier is opaque: it is useful for referring to a draft,
but it is never proof that the caller may access it.

The dedicated review renderer has a separate, deliberately small preload. It
does not receive or choose a draft identifier; the main process resolves the
current draft from the IPC sender:

| Action                      | Renderer receives                                                                                    | Never exposed                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Read review                 | State, timestamps, validated user fields, opaque artifact references, metadata, and safe diagnostics | Draft ownership, private resources, raw diagnostics, paths, handles          |
| Preview artifact            | The owned artifact's sanitized bounded log text or lossless PNG data URL and dimensions              | Unredacted logs, screenshot `Buffer` objects, paths, foreign-draft artifacts |
| Update description          | A refreshed safe review model                                                                        | Whole-draft replacement or arbitrary fields                                  |
| Include or exclude artifact | A refreshed authoritative selection                                                                  | Arbitrary paths, foreign-draft artifacts, or resource handles                |
| Prepare                     | A safe local summary and artifact count after the main-owned handoff                                 | Unselected artifacts, private resources, paths, or external handles          |
| Reopen review               | A refreshed mutable review model with the restored checklist                                          | The discarded snapshot, prepared files, paths, or resources                  |
| Open GitHub                 | Success or a structured safe error                                                                   | Prepared paths, arbitrary URLs, or external handles                          |
| Download files              | Success or a structured safe error                                                                    | The Downloads location, prepared paths, artifact bytes, or generic filesystem access |
| Discard                     | Success or a structured safe error                                                                   | Cleanup implementation details                                               |

Snapshots are copies, not mutable views of the main-process record. A draft
is created from the native menu or from the sidebar button's renderer
request; either way the source identity is derived in the main process from
the acting window, never supplied by a renderer. When the dedicated review window is bound, access belongs only to
that review window. Opaque artifact references are validated against both that
sender and its current draft; a reference is never authorization by itself.

Closing a source window discards only drafts not yet bound to review. An open
review remains usable after its source closes. Closing the review window,
cancelling, a failed review load, or explicit discard retires its in-memory
draft. Repeated approval returns the same approved summary. An approved draft
accepts no review mutation; it can only be explicitly reopened for review —
which discards its snapshot and returns it to the reviewing state — or
discarded.

## Approved Snapshot And Artifact Handoff

Approval remains an immutable input, not merely a UI state. The main-process
approved-snapshot handoff has these properties:

* Approval performs the final privacy scan and atomically captures the
  normalized user fields, approval timestamp, and ordered selected artifacts.
  Excluded and unavailable artifacts are absent rather than marked hidden.

* The snapshot owns immutable copies of its values or receives exclusive
  ownership of private resources. It must not retain references to mutable
  description fields, inclusion flags, renderer models, or collection state.

* The renderer receives only a safe approval receipt and prepared-artifact
  count. The main process resolves the snapshot from the sender-bound review;
  no approval reference, path, or resource handle crosses the handoff IPC.

* Artifact preparation accepts only the main-owned approved snapshot or a
  main-internal handoff object resolved from it. It must not accept a renderer
  report object, artifact list, filesystem path, or arbitrary draft ID, and it
  must not capture a new screenshot or reread logs and diagnostics.

* Claiming the snapshot for artifact preparation transfers cleanup ownership
  atomically from the review session to the handoff. Once claimed, closing the
  review window cannot invalidate an in-progress outcome. The handoff remains
  durable only for the current application session. The next application boot
  clears the complete temporary bug-report root; there is no recovery or
  history surface.

* Retries use the same snapshot and are idempotent. Generated files are
  derived outputs and cannot modify the approved source. Text is scanned again
  after final formatting and immediately before any file is written; failure
  remains fail-closed and exposes no partial sensitive artifact.

* Reopening review never mutates a snapshot: the draft drops its reference to
  the approved snapshot and pending handoff and returns to reviewing.
  Re-approval runs the same final privacy scan and captures a new snapshot.

The intended boundary is:

```text
REVIEWING
    ↓ explicit approval + final privacy scan
IMMUTABLE APPROVED SNAPSHOT
    ↓ main-owned atomic claim
ARTIFACT HANDOFF
    ↓ format + second scan + bounded write
TEMPORARY ARTIFACT OUTCOME
```

Until that handoff exists, `APPROVED` means only that the reviewed
configuration has been frozen locally. It does not authorize deriving an
artifact from the live draft or keeping sensitive resources after review
cleanup.

## Privacy Rules

The collection pipeline and later report outcomes must keep these rules intact:

* Capture only the selected StashBase window, never the operating-system
  desktop or another application.

* Use a fixed diagnostics allowlist: app version, packaged/development mode,
  Electron version, OS platform/release/architecture, and timestamp. Do not
  collect workspace identity, plugins, memory usage, hostname, user name,
  locale, network data, environment variables, or configuration values.

* Read at most the final 32 KiB of the application log and discard a leading
  partial line. The sanitized retained text is both the preview source and the
  resource eligible for approval; metadata never substitutes for that review.
  Never attach complete log history. Internal runtime-path startup diagnostics
  are excluded before the report boundary.

* Derive home-path replacement from the exact `os.homedir()` value and redact
  recognized credentials before preview. Independently scan the redacted
  result and exclude it when suspicious content remains. Scan again before
  writing any future artifact.

* Do not collect `config.json`, API keys, MCP bearer tokens, Agent
  transcripts, folder lists, or source-file contents.

* Keep authoritative screenshot bytes in main-process memory. The bound review
  window may request a size-bounded lossless PNG data URL made from those exact
  bytes so small text remains inspectable; the prepared attachment writes those
  PNG bytes unchanged. No resize, recompression, format conversion, lossy
  derivative, or filesystem location crosses the boundary. A prepared artifact
  is written only after the user includes it in an explicit outcome.

* Save and clipboard fallbacks, along with the current Downloads copy,
  browser, temporary-file, and cleanup work, stay main-process-owned and
  extend the draft lifecycle rather than adding renderer-side privileged
  access.

* Never print collected screenshot, diagnostic, log, or report content into
  the application log. Redaction and aggregate detector counts do not replace
  user review or the ability to exclude an artifact.

## Contribution Map

### Current

* Main-process-owned in-memory drafts with sender-bound authorization.

* Narrow renderer IPC with sender-bound review access, opaque artifact
  references, safe snapshots, and bounded per-artifact preview responses.

* Current-window-only in-memory lossless PNG capture, fixed diagnostics, and
  32 KiB log-tail collection.

* Credential/home-path redaction with a fail-closed post-redaction scan.

* Dedicated single-form review UI with one primary problem field,
  progressively disclosed optional reproduction steps, a compact attachment
  checklist with authoritative include state and per-row metadata, opaque
  per-draft artifact references, collapsed-by-default exact bounded safe
  previews, explicit local approval, and an explicit Back that reopens an
  approved draft for review.

* A main-private, logically immutable approved snapshot that contains only
  selected available resources and can be claimed for an in-progress handoff.

* Session-scoped, selected-only prepared artifacts with final text scans,
  atomic writes, next-boot cleanup, an explicit Report Ready handoff, a
  per-approval Downloads copy followed by a prefilled browser issue, and a
  Download action that saves the same durable copy without opening the issue.

### Next

* Add a copy-details fallback without changing the temporary handoff into
  report history or automatic submission.

### Coordinate First

* Any new diagnostic field, artifact type, retention policy, external URL, or
  submission mechanism.

* Changes to draft authorization, review-window ownership, IPC visibility, or
  report cleanup.

### Not Planned

* Hosted crash reporting, background telemetry, or automatic uploads.

* GitHub OAuth, access tokens, or direct GitHub API issue creation.

* Full-desktop capture, arbitrary file collection, or Agent transcript export.

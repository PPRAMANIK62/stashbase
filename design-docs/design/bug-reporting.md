# Bug Reporting & Privacy

Bug reporting should make a local failure actionable without turning StashBase
into a telemetry product. The user chooses when to begin a report, sees what
would be shared, and remains the only party who submits information outside
the application.

## Product Contract

- Reporting begins from a deliberate user action, including the native
  **Help → Report Bug…** entry that remains reachable when the main workspace
  renderer is unhealthy.
- Report preparation is local. It does not require a GitHub account, OAuth,
  a GitHub token, a hosted service, or automatic network submission.
- The application owns report drafts and any future report artifacts. They are
  not workspace files, are not indexed, and never appear in the file tree or
  search results.
- Renderer views are presentation only. They may show a safe description of a
  draft and request a lifecycle action, but they do not own artifacts,
  filesystem locations, privileged operations, or authoritative draft state.
- A report must be reviewed before any future sharing action. Redaction is a
  defence in depth measure, never a replacement for informed user review.

## Current: Draft And Collection Boundary

Selecting **Report Bug…** creates an in-memory draft through the Electron main
process. Draft creation attempts to capture the selected StashBase window,
collect the fixed diagnostics allowlist, and read a bounded recent server-log
excerpt. Collection failures leave the individual resource unavailable rather
than failing the whole draft. The native menu still uses a temporary
confirmation placeholder and discards its draft afterward; the review and
sharing outcomes are not implemented yet.

Screenshots and log text remain private application-owned data. Renderer-safe
snapshots contain resource availability and size metadata plus a copy of the
fixed, non-sensitive diagnostics allowlist; they never contain screenshot
bytes, log text, paths, handles, source-window identities, or mutable records.

## Ownership And Access

The desktop application creates a draft from the current native window. The
source window identity is derived in the main process, not supplied by a
renderer. A draft identifier is opaque: it is useful for referring to a draft,
but it is never proof that the caller may access it.

The renderer-facing lifecycle surface is deliberately small:

| Action | Renderer receives | Never exposed |
|---|---|---|
| Create draft | Opaque ID and safe snapshot | Source-window identity, paths, handles, screenshot bytes, log text |
| Read preview metadata | ID, state, timestamps, availability/size flags, allowlisted diagnostics | Mutable draft internals and sensitive collected content |
| Discard draft | Success or a structured safe error | Cleanup implementation details |

Snapshots are copies, not mutable views of the main-process record. A draft
can initially be accessed only by its source renderer. When a future dedicated
review window is bound, access transfers to that review window; the source
renderer no longer has draft access. This gives future review UI a clear
authorization boundary without trusting an ID or redesigning IPC.

Closing a source window discards its unreviewed in-memory drafts. A future
review window has its own retirement path, so closing the originating window
does not invalidate an already-open review session.

## Privacy Rules

The collection pipeline and later report outcomes must keep these rules intact:

- Capture only the selected StashBase window, never the operating-system
  desktop or another application.
- Use a fixed diagnostics allowlist: app version, packaged/development mode,
  Electron version, OS platform/release/architecture, and timestamp. Do not
  collect workspace identity, plugins, memory usage, hostname, user name,
  locale, network data, environment variables, or configuration values.
- Read only a bounded recent application-log excerpt. Never attach complete
  log history.
- Derive home-path replacement from the exact `os.homedir()` value and redact
  recognized credentials before preview. Independently scan the redacted
  result and exclude it when suspicious content remains. Scan again before
  writing any future artifact.
- Do not collect `config.json`, API keys, MCP bearer tokens, Agent
  transcripts, folder lists, or source-file contents.
- Keep screenshots in main-process memory for preview where possible. A future
  artifact is written only after the user includes it in an explicit outcome.
- Future save, clipboard, reveal, browser, temporary-file, and cleanup work
  stays main-process-owned and extends the draft lifecycle rather than adding
  renderer-side privileged access.
- Never print collected screenshot, diagnostic, log, or report content into
  the application log. Redaction and aggregate detector counts do not replace
  user review or the ability to exclude an artifact.

## Contribution Map

### Current

- Main-process-owned in-memory drafts with sender-bound authorization.
- Minimal renderer IPC with opaque IDs and safe snapshots.
- Current-window-only in-memory screenshot capture, fixed diagnostics, and
  bounded log-tail collection.
- Credential/home-path redaction with a fail-closed post-redaction scan.
- Native menu entry with a temporary review placeholder.

### Next

- Replace the placeholder with a user-review surface that previews the
  screenshot, can exclude screenshot/log resources, and collects report text.
- Add temporary artifact creation, bounded cleanup, save/copy fallbacks, and
  the explicit browser handoff described by Issue #114.

### Coordinate First

- Any new diagnostic field, artifact type, retention policy, external URL, or
  submission mechanism.
- Changes to draft authorization, review-window ownership, IPC visibility, or
  report cleanup.

### Not Planned

- Hosted crash reporting, background telemetry, or automatic uploads.
- GitHub OAuth, access tokens, or direct GitHub API issue creation.
- Full-desktop capture, arbitrary file collection, or Agent transcript export.

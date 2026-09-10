# Subphase 6 — External, Reporting, and Recovery

## 53 — Expose external MCP status and configuration

**Blocked by:** 45, 46.

**Status:** Complete.

Complete J08 renderer responsibilities with Settings-owned credentials,
authorized scope, truthful tool capabilities, and recoverable status.

The MCP section of the Task 46 Settings shell now renders instead of
standing as a placeholder. It reads the standard stdio configuration, the
launcher command, the loopback URL, the bearer token, and the Docker opt-in
through a Settings-owned port over registered wire schemas for the existing
status, token-rotation, Docker-access, and Docker-port routes. The domain
model resolves the listener's two booleans and optional reason into one
`off`, `starting`, `active`, or `failed` state, answering from the live
listener first so a host-facing port that is genuinely open is never drawn
as off. The token stays masked until asked for, rotation asks first and
names that existing clients stop working, every write replaces the cached
listener with the server's own answer, and an older failed write never undoes
a newer one. Copy actions cover the configuration block, both URLs, and the
token through one clipboard helper; nothing is persisted on the renderer
side and nothing claims a tool capability the server does not report.

Evidence: focused domain projection, protocol schema, adapter, hook
ordering-guard, component, story accessibility, architecture, typecheck,
lint, format, and renderer build checks.

## 54 — Rebuild the bug-report review window

**Blocked by:** 13, 19.

**Status:** Complete.

Complete J09 in a separately sandboxed window with private artifact review,
explicit approval, handoff, source-window independence, and retirement.

The review window is now a second page of the replacement renderer, served
over `app://` with the same strict CSP as the workspace, in a sandboxed,
context-isolated window with its own bundled preload. Main keeps every
authority: the draft service, collection, redaction, approval, and handoff
modules are unchanged, review IPC is registered inside the replacement
boundary with sender authorization, and main parses each response against
the shared schema before it crosses to the window, so a future service field
cannot widen what the page reads. The renderer models the session as one
reducer over `loading`, `unavailable`, `reviewing`, `preparing`, `ready`,
and `closed`, with every asynchronous completion stamped by a generation so
a late result cannot revive a closed or reopened review; opening a preview
touches only the preview state, Back builds a fresh review with no approval,
and closing discards. The replacement sidebar gains the Report a bug entry
beside Settings through a new `bugReport` window capability, disabled with an
explanatory label when the bridge is absent, and the native Help entry keeps
working. The legacy page still serves the dev-Vite path until cutover.

Evidence: focused protocol, domain, runtime, adapter, hook, component, story
accessibility, platform bridge, Electron preload/IPC/window, app-protocol,
boundary smoke (both pages), architecture, typecheck, and web build checks,
plus a driven runtime pass opening the rebuilt review from the replacement
shell through prepare, back, and cancel. J09 journey evidence is deferred to
finalization.

## 55 — Add protected draft-journal storage

**Blocked by:** 31 and approval of key-management rules.

**Status:** Implemented; awaiting acceptance of
[Decision 0017](../decisions/0017-protected-draft-journal.md).

Store bounded, protected, version-bound unsaved snapshots outside visible
workspaces under server-side File Transactions ownership.

Decision 0017 answers the open key-management questions: Electron provisions
one random key per installation, wraps it with `safeStorage`, and hands it to
the owned server over the same process-private spawn path as the shutdown
token; the server scrubs it from its environment before any daemon or Agent
child can inherit it. Without OS-protected storage the journal is disabled,
reports itself unavailable, and writes nothing. The server module keeps one
AES-256-GCM envelope per source under the private local-data directory,
keyed by a hash of the folder and folder-relative path, bound to the source
version the draft was typed over, written atomically with owner-only modes,
and bounded to 2 MiB per entry, 64 entries, and 14 days. Folder-explicit
routes list metadata, read one entry, upsert, and delete; each converges on
repeat. The renderer journals a dirty document off the interaction path,
debounced and coalesced with a maximum delay under continuous typing, and
clears the entry on the dirty-to-clean transition, which covers save,
overwrite, and conflict reload alike.

Evidence: focused journal tests for envelope round trip, replacement,
listing, idempotent removal, the size, count, and age bounds by value,
eviction, tamper and rename rejection, and POSIX modes; route tests for
membership and path refusal, metadata-only listing, unavailable and
over-bound responses, and repeated writes converging; Electron key-provider
tests for creation, reuse, corrupt-file regeneration, no plaintext at rest,
null without OS protection, and the child-environment builder; protocol
schema tests; `pnpm test:library-files`; root and web typecheck; and a live
probe confirming the key never reaches the daemon's environment.

## 56 — Restore or discard crash-recovery drafts

**Blocked by:** 55.

**Status:** Complete.

After an unclean exit, offer explicit restore or discard without silently
overwriting the source or confusing recovered content with durable content.

When a folder becomes active the shell lists its surviving entries and
renders one inline "Unsaved changes from a previous session" surface with
per-draft Restore and Discard plus Discard all. Each candidate carries a
staleness derived from the draft's expected version against the current
source, and a changed or missing source is named before restore. Restore
opens or activates the tab and loads the snapshot as an unsaved draft whose
editor version is the draft's expected version, so a current draft simply
autosaves and a stale one meets the ordinary conflict decision; the source
is never written directly. Discard deletes the entry. A handled entry leaves
the list, and the list refreshes on folder change and after each decision.

Evidence: focused domain, runtime, adapter, component, and composition tests
for staleness derivation and ordering, the restore transition and its
refused outcomes, debounced and coalesced journaling with clearing on save,
suspension on a disabled journal, folder-scoped listing with named
unavailable and failed states, restore and discard decisions with pending
state, discard-all, and the shell's per-folder wiring, plus a driven run of
the real Electron app with a stand-in keyring that proved crash, relaunch,
offer, restore, dirty editor, autosave, and journal clear end to end. Journey
coverage remains deferred to finalization.

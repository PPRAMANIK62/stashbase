# Subphase 5 — Agent and Convergence

## Current execution order

After runtime configuration in Task 46, complete the independently unblocked
Agent thread through session lifecycle, composer turns, and permissions in
Tasks 47–49. Then return to Preparation and Retrieval in Tasks 43–45 before
connecting source context, document writes, and durable conclusions in Tasks
50–52. Task 50 remains blocked by Task 45; the earlier Agent work must not
invent source readiness, attachment, or mention behavior ahead of that owner.

## 46 — Configure Agent runtime and credentials

**Blocked by:** 12.

**Status:** Complete.

Settings opens as a lazy responsive dialog whose section rail becomes a mobile
drawer. Agents, General, AI Index, and Transcription are live; Appearance (task 61) and
MCP (task 53) show “Soon.” A pure runtime description drives staged setup, allowance,
managed uninstall, and debug-gated bootstrap testing. React Query boundaries
poll only while preparing and keep mutation failures at their owning control.

Every section is built from one row grammar owned by the settings feature: a
pane title, titled groups, hairline lists, and rows of leading slot, title
with one-line detail, and trailing control. A control inside a row never
renders its own label, because the row title is the label. A setting that
picks one of several options is a choice row whose radio sits in the leading
slot, so the whole row is the option; short single-word options use a
segmented control in the trailing slot instead. The modal has one ground and
one shared tint for pressable or typeable controls: no card fills, no tinted
notice rows, and the section rail sits on the page background. State reads as
form (a dot-and-word chip, a bar, a red icon and title) rather than as colored
sentences. The Fluid `RadioGroup` and `InputGroup` lists are not used inside
Settings rows, since their fixed width and own labels were the cause of the
duplicated labels, pill highlights, and squeezed model list in the first pass.

Evidence: focused domain, adapter, hook, component, protocol, architecture,
typecheck, lint, and renderer test checks.

## 61 — Choose appearance preferences

**Blocked by:** 12, 46.

**Status:** Not started.

Add the Appearance section to the Settings shell so a person can choose the
theme (match system, light, dark), the interface size, and the reading text
size as the same three presets the legacy panel offers. Each preference is one
row on the task 46 grammar with a segmented control in the trailing slot; the
presets are small single-word choices, so they never become choice rows. The
section reads and writes the existing `AppearancePreferences` presets over the
appearance HTTP route through a registered wire schema and a Settings-owned
port. A change applies to the window at once through the stylesheet's forced
theme classes and size scale, saves optimistically, and rolls back only when
the newest write fails, so an older failed save never undoes a newer one. Other
open windows follow through a renderer-side broadcast rather than server
window context. Reading text size changes reading surfaces only; interface
size changes chrome only. Applying the saved preferences before first paint at
startup stays with task 59.

Evidence: focused protocol, adapter, hook, component, architecture, typecheck,
lint, and renderer test checks.

## 47 — Create and restore Agent sessions

**Blocked by:** 25, 46.

**Status:** Complete.

Window-scoped runtimes own blank reuse, scoped history, bounded reconnect,
folder retirement, and disposal. Readiness gates transport; started work never
rebinds. Electron authorizes the socket and supplies window identity.

Chats lists the selected folder newest-first by day, merges mounted and native
sessions, hides empty allocations, and supports rename and confirmed deletion.
Recency is the later of the native record and the last submitted prompt, so
opening a chat never promotes it. A chat opens at its latest message and
follows new content only while the reader is at the end. Beside an open
document the Agent pane is resizable from its seam by drag, arrow keys, or a
double-click reset, and the width persists in the workspace session.

Evidence: focused domain, runtime, component, adapter, protocol, Electron,
server, architecture, typecheck, lint, and web build checks. J06 evidence is
deferred.

## 48 — Run composer turns

**Blocked by:** 47.

**Status:** Complete.

The session runtime owns transport-free drafts, first-use connect and send,
bounded queued follow-ups, streaming text and thinking, idempotent
interruption, structured failure, and in-place retry. Input stays editable
while the Agent works. Only the composer subscribes to the draft, and
transcript blocks are memoized, so keystrokes never touch the transcript.

An empty chat centers a greeting, a three-row composer, and up to three
starter chips drawn from the folder's top-level entries; chips prefill and
never send. The shell maps the listing to `AgentScopeOutline` so the features
stay decoupled. The first message docks the composer without resizing it.
Connecting and restoring are silent; only disconnect, folder removal, or a
closed chat shows a status row.

Evidence: focused domain, runtime, WebSocket adapter, composer, component,
architecture, typecheck, lint, and web build checks.

## 49 — Present permissions and tool calls

**Blocked by:** 13, 48.

**Status:** Complete.

Validated tool and permission events enter pure session transitions. Ordinary
work folds into a collapsed disclosure; approval asks stay inline and settle
only the matching request. Arguments and results render as bounded inert text.
Denied and cancelled tools ignore late output; disconnect or retirement settles
pending work.

Transcript: no provenance rail, muted thinking, amber only for permission asks,
one Copy after the final reply of a settled turn, a hover time per prompt, and
a day divider where a prompt opens a new day. A permission decision returns
focus to its heading.

Provider, model, and thinking controls live in the composer, hide when
unsupported, and lock during turns. Model changes use the native next-turn
command; thinking changes reconnect because Claude fixes effort at connection.

Evidence: focused domain, runtime, protocol, component, architecture,
typecheck, lint, and web build checks. J06, visual, and screen-reader evidence
is deferred.

## 50 — Attach source context and mentions

**Blocked by:** 35, 45, 48.

Bind attachments and mentions to explicit source identity/version, expose
Preparation needs, and reject stale context safely.

## 51 — Apply Agent document writes and Diffs

**Blocked by:** 33, 49, 50.

Review and apply Agent changes through versioned file authority with explicit
permission, Diff evidence, save recovery, and conflict handling.

## 52 — Converge Chat conclusions into documents

**Blocked by:** 51.

Complete J07 by writing explicitly accepted conclusions into ordinary durable
source documents rather than treating conversation as source truth.

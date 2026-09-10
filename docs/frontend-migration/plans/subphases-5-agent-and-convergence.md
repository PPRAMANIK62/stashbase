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
Opening the first document, or closing the last, changes only pane widths in
one always-mounted row: the Agent workspace keeps its transcript, draft, and
focus, both panes hold their final widths from the first frame, and only the
seam moves on the moderate spring while the titlebar crossfades to the tabs.
Dragging the seam stays instant, and reduced motion snaps.
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
focus to the activity summary that receives the decided tool (Task 51).

Provider, model, and thinking controls live in the composer, hide when
unsupported, and lock during turns. Model changes use the native next-turn
command; thinking changes reconnect because Claude fixes effort at connection.

Evidence: focused domain, runtime, protocol, component, architecture,
typecheck, lint, and web build checks. J06, visual, and screen-reader evidence
is deferred.

## 50 — Attach source context and mentions

**Blocked by:** 35, 45, 48.

**Status:** Complete.

Research: [Source context and mentions research](../research/agent-context-task-50.md).

Bound context is one ordered list of items on the session: a library source
carries its folder-qualified identity, listing format, and the conversion
version seen when it was bound; a transient upload carries the temp path the
server wrote outside every folder. The composer's text field is a CodeMirror
document behind an editor slot on the shared composer: typing `@` opens a
listbox ranked over the selected folder's listing, and accepting a file
replaces the query with one atomic chip that sits in the sentence, moves with
the text, deletes as one character, carries its Preparation state as a dot,
and serializes as `@path`. Dropping a file-tree row inserts the same chip for
a non-visual source; an image or PDF drop and every upload land in the
composer's preview row as square tiles with the thumbnails' own spring and
hover remove badge, and Reprocess is offered on a failed tile. Sent turns
show the chips inline in the bubble and the tiles above it the way the chat
message component shows files. A send re-validates every item against the shell's
published listing and readiness and again through the context-file route: a
removed or retired source refuses the send with the draft intact and one
alert; a preparing or failed source is explained and sent. Queued follow-ups
keep their own snapshot and validate at dispatch. The wire prompt keeps the
text-only contract with the `Attached files:` suffix both runtimes and history
replay already read, and a retry resends exactly what went out. Replayed
history shows the same tiles from the server's preview route.

Follow-up (2026-09-09): typing `/` opens the runtime's skill catalog the way
`@` opens the listing, for a runtime whose capabilities advertise skills. The
catalog arrives on the session's `skills` event and lives on the session with
its state. Picking a skill seats one atomic `/label` token at the head of the
draft and arms the skill for one turn; the token serializes to nothing,
because the server composes the skill into the wire prompt. Deleting the
token disarms, a catalog refresh that drops the armed id disarms, a queued
follow-up snapshots its skill beside its context, and a retry resends the
same skill. The transcript shows the turn as `/label text`, and a skill with
an argument hint lends it to the composer as the placeholder. A failed
catalog reads "Could not load skills." with Retry, which asks the runtime to
re-read them; an empty one says so, and Enter over an empty skill panel never
sends. The shared composer gained a sendable-without-text switch, so a skill
alone or bound tiles alone can be sent.

Known gap: mentions are offered only for the selected folder's chat; a
Library or cross-folder chat validates dropped sources as stale until the
server resolves them. A skill catalog arrives only once the session is
connected, so a chat that has not sent yet lists no skills.

Evidence: focused context domain, session and workspace runtime, context
adapter, protocol, composer, transcript, file-tree drag, shell composition,
skill catalog domain, runtime, adapter, editor, composer, and shared input
tests, architecture, typecheck, lint, and web build checks.

## 51 — Apply Agent document writes and Diffs

**Blocked by:** 33, 49, 50.

**Status:** Complete.

Research: [Agent document writes and Diffs research](../research/agent-file-changes-task-51.md).

Every runtime's write lands on one file-change shape: a path, an action, the
text on both sides when the runtime gave it, a unified patch when that is all
Codex gave, and the server's own counts for a native diff. A permission ask
for a write shows the diff instead of raw arguments, so the decision is made
on evidence; the expanded tool row shows the same diff after the fact. Once
decided, the ask stops being a card: the tool folds into the collapsed
activity group as an ordinary row that still opens to the same diff and reads
Denied when rejected, and focus moves to that group's summary. The
diff is a read-only CodeMirror unified merge view in the code editor's mono
surface, with unchanged regions collapsed, word-level changes marked, syntax
from the bundled language data, additions in green, and deletions in red
through dedicated diff tokens. The Built-in agent's native `file-diff` events enter
the transcript as settled `FileDiff` blocks, the same shape replayed history
carries. A settled activity group ends with each changed file once and an
Open control only for paths inside the scoped folder; opening is the user's
choice and routes through the shell's document workflow. After a write tool
settles without error or a native diff arrives, the shell refetches the folder
listing and the open documents behind the changed sources, then requests a
folder-explicit sync and refreshes readiness. A clean editor takes the newer
disk text through the existing reconcile path; a dirty editor keeps its draft
and meets Task 33's versioned conflict on its next save.

Known gap: a Codex change without a patch, a NotebookEdit, and a deleted file
list as changed files without diff evidence. Native Claude and Codex writes
reach the AI Index only through the post-write sync; a sync that is cut short
leaves the index to the next explicit sync.

Evidence: focused file-change domain, session domain, adapter, runtime, diff
view, activity, documents query, preparation adapter, protocol, architecture,
typecheck, lint, and web build checks. J07 journey evidence is deferred to
finalization (see Task 52).

## 52 — Converge Chat conclusions into documents

**Blocked by:** 51.

**Status:** Complete.

Research: [Chat convergence research](../research/chat-convergence-task-52.md).

Complete J07 by writing explicitly accepted conclusions into ordinary durable
source documents rather than treating conversation as source truth.

The journey needed no new surface. The split row already keeps the Canvas
beside the conversation, Task 51's permission card and post-write refresh
already carry the write, and Task 33's reconcile and conflict decisions
already keep the source recoverable. Task 52 adds the explicit gesture that
names the target and proves the chain. Every open document tab is a drag
source carrying the same payload as a file-tree row, so dropping the Canvas
tab on the composer binds it as a mention chip through the drop path Task 50
validates. The shell publishes the open tabs' folder-relative paths beside
the listing, and the mention ranking places an open document ahead of an
otherwise equal match and first for an empty `@`; nothing is attached
without the user's gesture. The shell's clipboard-image guard now recognises
the CodeMirror composer as a text entry, so an image pasted into the
composer is no longer also offered as an import. One composition test drives
a settled Agent write while `Welcome.md` is open and checks that the listing
refetches, the active tab and focus stay put, the changed-files Open routes
into the document workflow, a clean editor adopts the newer text, and a
dirty editor meets the reload, merge, or overwrite decision.

Known gap: the composition test stubs the Milkdown builder, so it proves the
shell-to-conflict chain rather than the editor's own editing. The legacy J07
The retired journey suite targeted selectors the replacement renderer does not have
and cannot run against the served build; it is rewritten at finalization.

Evidence: focused tab drag, mention ranking, shell composer-focus, and J07
composition tests; typecheck, lint, architecture, and web build checks.
J07 accessibility and real-runtime Canvas write evidence
remain deferred to finalization.

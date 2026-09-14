# User Journeys

User Journeys are the stable product-behavior backbone between scenarios,
area design, implementation, and evidence. Each `Jxx` identifier names an
observable outcome rather than a screen or test case. Tests and Evals may cite
the identifier, but exact fixtures and assertions remain in the evidence.

A journey records the primary flow and the results users must be able to
observe. Shared ownership, trust, and lifecycle rules stay in area designs and
engineering contracts rather than being copied into every journey.

The primary sequence is **enter a project → discuss ideas and brainstorm →
write → refine**. Project entry, conversation, drafting, and ordinary editing
and review are implemented. Document-specific diff for fine revision is the
remaining feature; existing file diffs and save-conflict comparisons should
not be described as that completed experience.

J01 owns onboarding and first value; J10 owns the recurring project workflow.
A project can be empty and a discussion can be useful without a file write.
Search, preparation, Build Wiki (J12), and Gallery (J13) support the workflow
when useful. They are not required before brainstorming. J11 retains the
secondary conversation-to-project boundary and its unavailable in-app entry;
it is not the primary activation route. Journey IDs are preserved for existing
links, while evidence must be reassessed when a flow changes.

## J01: Complete onboarding and reach first value

### Outcome

A first-time user understands that StashBase is an IDE for writing, enters an
ordinary local project, and can begin a useful discussion with an Agent.
Existing material is optional. Local work remains available while an Agent
needs its own setup, and returning users retain their projects and settings.

### Entry State

The app opens a welcome window. The user may have an existing folder, want an
empty project, or choose a GitHub/Gallery copy. No account, Agent readiness,
reference file, wiki, or meaning-based index is assumed.

### Primary Flow

1. Open an existing folder, create a project, or import one from GitHub or
   Gallery. On a pristine default folder home the seeded Start Here project
   is another optional entry, not a forced tour.
2. Enter the project without waiting for background preparation or indexing.
   Chat is available before any document is opened.
3. Use the selected Agent. OpenQuill may need account sign-in; a bring-your-own
   runtime may need its explicit installation or provider authentication.
   The composer retains the idea while that stage is resolved.
4. Send an idea, question, or request and continue the discussion. Consult
   project material or start writing when useful. Neither a search nor a
   document write is required to establish first value.
5. On a later launch, choose the project from Recent and continue its work.
   A fresh window starts at Welcome rather than silently reopening a folder.

### Required Observable Results

- Empty and source-filled projects are both valid. Onboarding never requires
  wiki generation, opening a source, or an embedding key before discussion.
- Entering a project does not silently send a prompt, install an Agent, or
  start account sign-in. Runtime setup and actual send remain deliberate.
- Local browsing, editing, preview, and keyword search remain available
  independently of an online account or Agent readiness. This does not claim
  that a selected Agent can answer without its required model service.
- The user can distinguish their local files, application-derived data, and
  any context sent to an Agent or configured embedding provider.
- Start Here is seeded only for a pristine default folder home, never
  overwrites an existing home or user copy, and is not recreated after removal.
- Search by meaning is available only through its opt-in Settings path and is
  not offered by onboarding while disabled.
- Project registration, settings, and saved per-project workspace state remain
  recognizable on return. An unavailable optional service does not remove
  access to local work.

### Degradation and Recovery

A failed project open or import is retryable without corrupting existing files
or changing another window. Agent installation, authentication, or connection
failure retains the unsent request and identifies the failed stage. The user
can continue local work or choose another supported Agent. Failed seeding does
not publish partial guide content as a completed project.

Current copy and packaged Instructions still emphasize wiki building. This is
an alignment issue in the implemented entry, not a missing brainstorm feature;
see [Agent Panel](design/agent-panel.md#product-language-alignment).

### Evidence

See [J01 evidence](../code-review/journey-coverage.md#j01-onboarding). Existing
startup, folder, and setup evidence remains useful, but does not by itself
prove first value from an empty-project brainstorm.

## J02: Add and open a folder

### Outcome

An ordinary local folder joins the project registry and becomes usable without changing
its ownership, layout, or storage model.

### Entry State

The user has a local folder to open, chooses a location in which to create
one, or has a public GitHub repository URL to import into their folder home.

### Primary Flow

1. Open or create a folder, or import a public GitHub repository, from Welcome or the native project actions.
2. Enter the folder before recursive preparation or indexing finishes.
3. Begin a project Chat, or browse and edit files when useful. An empty folder
   is a valid project. Another project opens in another window.
4. When no longer needed, deliberately remove the project registration.

### Required Observable Results

- Opening, creating, or importing a folder does not migrate its contents into
  managed storage or dirty foreign working trees.
- GitHub repository import executes shallow single-branch clones into isolated
  staging, validates against submodules and Git LFS, and publishes without
  changing an existing destination in the folder home.
- Folder entry prioritizes navigation; recursive background work does not hold
  the workspace closed.
- Separate project windows preserve independent documents and Chats while
  sharing the project registry and runtime services.
- Removing membership clears only StashBase-owned state and leaves the source
  folder on disk.

### Degradation and Recovery

A failed or slow open remains retryable and does not strand another window or
folder context. A failed open preserves the previous selection and registration;
a late query or superseded open cannot undo a newer selection. Failed,
cancelled, or rejected GitHub imports clean up staging
directories without corrupting existing registered projects. Publication failures
remove only unchanged import-owned content; concurrent additions, edits, and
replacement directories remain intact. Git availability detection is cancellable
and times out instead of holding import indefinitely. Removal
either finishes its owned cleanup before membership is committed or remains
recoverable without deleting user files. Opening or re-entering a folder never
creates or edits an Agent instruction file.

### Evidence

See [J02 evidence](../code-review/journey-coverage.md#j02-folder).

## J03: Read and edit source documents

### Outcome

The user sees the truthful active-folder source tree, opens ordinary files with
their declared capability, and edits content-editable formats with durable and
explicit save behavior.

### Entry State

An authorized folder is open. The user can create a new Markdown draft or
open an existing entry with the capabilities in the
[Documents format capability matrix](design/documents.md#format-capability-matrix).

### Primary Flow

1. Create a new draft, or open an existing source as a preview or kept tab,
   and receive only the preview or editing capabilities declared for that
   format.
2. For content-editable Markdown, JSON, or UTF-8 plain text, enter the appropriate editing state
   and save through the shared durability path.
3. Navigate with tabs, back and forward through the document history, Quick
   Open, the outline, Find, local links, or search results.
4. Close the tab or window, or use renderer-error recovery, after the current
   edit becomes durable.
5. After an interrupted session, reopen the folder and restore or discard each
   unsaved draft it left behind.

### Required Observable Results

- The visible source file remains the identity behind every view and save.
- Repeated or concurrent navigation to that source resolves to one tab, and
  browsing holds at most one preview tab; a same-named source in another
  project folder remains distinct.
- Back and forward step through the documents visited, in order, reaching a
  preview that has since been replaced without adding a kept tab, whenever
  the sidebar shows anything but Chats.
- **Create new draft**, on the strip's New tab, creates an Untitled Markdown
  file beside the selection, opens it at once as a kept tab, and starts
  renaming it in the Files tree so the name is the first thing typed.
- Preview-only formats never expose a content-editing affordance. Workbench
  content editing, Agent/MCP content writes, and file-level rename/move/delete
  remain distinguishable capabilities.
- Generic files remain visible but muted, appear in Quick Open, and either
  open as strict read-only UTF-8 text or retain their identity in an explicit
  binary, oversized, or unavailable state. Muted means they are absent from
  Search and automatic Chat context.
- Excluded infrastructure is represented by a non-expandable folder row rather
  than silently traversed or silently omitted. Every restricted entry — file or
  folder — exposes **Show in Finder / File Explorer** on hover/focus and by
  keyboard, so reduced StashBase capability never implies that the source is
  unreachable. Hidden derived artifacts never surface.
- The file tree menu's checkable **Show hidden files** preference is
  application-level and durable. Off (the default and the recovery for
  invalid stored state) preserves the current view, including visible
  ordinary dotfiles, which are listed in either state. On surfaces eligible
  user-owned dot-directories and their descendants in the tree and Quick Open
  with their declared capability. `.git` and other VCS
  databases, `.stashbase` and `.stashbase-*` product state, StashBase-derived
  artifacts, dot-notes, and junk metadata never
  surface in either mode; hidden excluded caches stay bounded non-expandable
  rows; and hidden-directory content remains outside Preparation, indexing,
  Search, automatic Chat context, and Agent/MCP discovery. Turning the
  option off removes hidden rows from the tree, keyboard order, selection,
  and Quick Open without closing open tabs or discarding edits.
- Writer/reader, JSON Tree/Source, and literal plain-text transitions preserve
  the same source content rather than creating a second document model.
- Unsupported plain-text encoding keeps the source identifiable, read-only,
  and byte-unchanged; it never enters retrieval as replacement-character text.
- Navigation, window retirement, and product-owned renderer recovery do not
  silently discard a live edit.
- Unsaved text in a content-editable source survives an interrupted session.
  Reopening its folder lists what was left, identifies each file and when its
  text was captured, says when the file has since changed or gone, and
  restores or discards each draft independently. A restore writes nothing. It
  returns an unsaved draft carrying the version its text was typed over, so
  the save barrier and conflict flow still decide what reaches disk. Drafts
  never live inside a project folder, so folder sync, backups, and indexing
  never see them, and signing out of an account does not remove them.
- Parse, preview, decode, or availability failure keeps the source identifiable
  and recoverable.

### Degradation and Recovery

A failed save blocks renderer recovery. If a root failure has already removed
the save barrier, reloading requires an explicit warning that unsaved changes
may be lost. A concurrent version conflict keeps the dirty buffer and newer
disk source visible until the user reloads, overwrites, or merges. Leaving or
reloading cannot bypass that decision. Without operating-system key protection the
draft journal is disabled rather than falling back to unprotected storage, and
no unsaved text outlives the session.

### Evidence

See [J03 evidence](../code-review/journey-coverage.md#j03-documents).

## J04: Prepare a hard-to-read file

### Outcome

A PDF, DOCX, image, audio, or supported video source becomes searchable and
Agent-readable while the original remains
visible and authoritative.

### Entry State

An authorized folder contains a source whose useful text requires extraction,
OCR, or transcription.

### Primary Flow

1. Open or add an existing source.
2. Continue browsing while OCR or other preparation runs.
3. Observe preparation status only when it changes the next useful action.
4. Search or let an Agent read the current prepared text after completion.
5. Retry or reprocess after an actionable failure or explicit cancellation.

### Required Observable Results

- Preparation never replaces the source or blocks its ordinary preview.
- First PDF/OCR preparation downloads its local component in the background
  without a confirmation. Waiting tasks resume automatically; later preparation
  reuses the installed component offline. Failure leaves sources waiting until
  one retry on the next launch or an explicit Retry in Settings → General →
  Local components; status reads do not start an unused download.
- Direct-text readable formats remain usable without Preparation. Formats that
  require prepared text expose only current format-appropriate OCR, extracted
  text, or transcripts to retrieval and Agents.
- Completion means format-specific output is both complete and fresh for the
  current source bytes.
- Preparation readiness and readiness for search by meaning remain
  distinguishable.
- Generated text, checkpoints, and indexes never become workspace files.

### Degradation and Recovery

Stale, partial, cancelled, or incompatible output never counts as current
truth. Missing optional native capability produces a blocked or retryable state
without making the source itself a failed file.

### Evidence

See [J04 evidence](../code-review/journey-coverage.md#j04-preparation).

## J05: Search and open source evidence

### Outcome

A person finds relevant evidence inside one selected authorized Folder and
returns to the visible source that supports it.

### Entry State

The project registry contains direct-text readable or currently prepared sources as
classified by the
[Documents format capability matrix](design/documents.md#format-capability-matrix).
Searching by meaning may be ready, partially ready, not set up, or
unavailable.

### Primary Flow

1. Enter one query in the sidebar's search panel.
2. Use keyword search without additional setup, or search by meaning once an
   OpenAI or OpenRouter key has been added under **Settings → Search by
   Meaning**; the **By meaning** mode appears only then.
3. Review ranked evidence and readiness guidance.
4. Open a result in its visible source context.

### Required Observable Results

- Result scope never widens beyond the folder the query was asked in.
- Every result identifies a user-visible source rather than derived storage.
- Retrieval uses direct source text or current prepared text according to the
  source format; it never treats previewability alone as searchable text.
- Missing results are distinguishable from preparation, indexing, or provider
  state.
- Keyword search remains usable when semantic work cannot continue.
- Representative meaning-based queries retrieve relevant source evidence even
  when the query and source use different wording.

### Degradation and Recovery

Known-stale semantic evidence becomes unavailable before failed work is
presented. Current indexed files may remain partially useful, and replacing
the key resumes pending work without blocking local-file workflows.

### Evidence

See [J05 evidence](../code-review/journey-coverage.md#j05-search).

## J06: Start and continue an Agent chat

### Outcome

The user brainstorms, asks questions, drafts, and revises with an Agent in a
project while retaining control of account use, installation, context, tools,
and permissions. J11 separately records the unavailable unbound entry.

### Entry State

A project, possibly empty, is open and has a reusable blank Chat. **OpenQuill**
is selected by default and may need account sign-in; a bring-your-own runtime
may be ready, missing, disconnected, or recoverable.

### Primary Flow

1. Use **New chat** from the Chat pane's name row with OpenQuill, or choose
   another Agent in the composer. A Chat takes the open folder as its scope.
2. For OpenQuill, sign in to the StashBase account when needed, from the
   account row at the foot of the sidebar or from the Agents section of
   Settings; no Agent install, model API key, or separate recharge is
   required within the free credits' fixed seven-day window.
3. When a bring-your-own runtime is missing, explicitly choose **Install and
   continue**. When Codex is installed but signed out, choose **Sign in with ChatGPT** and
   finish the provider-owned browser flow started by that same runtime.
4. Send an idea or request. Attach or retrieve project material only when
   useful; no source file or wiki is required to brainstorm.
5. Optionally customize **Agent Instructions** for the Chat's working folder.
   The readable default already applies; StashBase stores a
   customization without writing to the source folder.
6. Inspect streaming output, tool activity, permissions, runtime-supported
   attachments, failures, and file artifacts.
7. Continue, edit and resend, or open a source beside the same mounted Chat.
   Use the top-right panel icon to hide Chat for more reading space and reopen
   it with the conversation and draft intact.
8. Return to project history, or open another project in its own window
   without silently rebinding this conversation.

### Required Observable Results

- Opening the app, a folder, a tab, or history is never runtime-installation
  consent.
- OpenQuill uses only its included pinned runtime and the account's free
  credits; its account token is absent from the renderer and OpenCode state.
- Signing in for OpenQuill establishes account identity and nothing else.
  Search by meaning has no account path and is turned on only by a key under
  Settings.
- OpenQuill does not offer transient attachments until its isolated
  runtime can read their bytes through an authorized scope. Bring-your-own
  runtimes retain attachment support.
- Settings reports the free credits' current seven-day window as a remaining
  percentage and refill time, with optional token detail but no monetary
  balance. A submitted
  prompt and its auxiliary model calls share one server-enforced turn limit.
- Codex authentication uses the executable StashBase already discovered or
  installed. StashBase neither installs a second copy nor receives the
  provider credential.
- A started draft, turn, attachment set, or restored conversation retains its
  visible scope.
- A follow-up submitted during an active turn remains visibly waiting and can
  be deleted individually before send without interrupting that turn or
  removing another queued follow-up. Steering remains available only when the
  selected runtime supports it.
- Agent Instructions resolve exactly one scope, and scopes never combine.
  That scope's packaged default applies until the scope is customized. A save
  persists in
  StashBase application config and applies to Chats mounted after the save.
  An already mounted session keeps its initial instructions. No save creates
  or changes `AGENTS.md`, `CLAUDE.md`, or another source file.
- Removing that scope silently returns only a completely blank Chat to
  an unbound internal scope; Welcome does not expose an unbound Chat. Any Chat containing user work remains readable, cancels unfinished
  work without presenting a transport failure, and says the folder was removed
  and the transcript is preserved instead of offering Retry.
- Chat-primary and docked layouts preserve the same session and in-progress
  state.
- Commands, network, deletion, and broader filesystem access remain explicit
  permission decisions.
- Successful Auto reviews do not interrupt the transcript; a blocked,
  interrupted, or failed automatic review remains visible without becoming a
  turn failure.
- Tool and source use remain inspectable without turning generated artifacts
  or transcripts into hidden product state.
- Agent search defaults to its bound project. An unbound Chat must open or
  create a project before reading or searching project files; an external MCP
  client selects an authorized project explicitly. Invalid scope never falls
  back to broader search.
- With no explicit mode, `search_project` uses keyword search without an
  embedding key and search by meaning with one, including after key changes.
  Explicit keyword search remains available; explicit search by meaning reports
  a missing key or provider failure rather than changing strategy silently.
  Each lookup retains project scope and visible source identity without
  controlling background indexing.
- A source is presented as Agent-readable only when the selected Agent surface
  can consume that format's source or current prepared representation. OpenQuill
  attachment behavior must not be implied for an external MCP client.

### Degradation and Recovery

Account sign-in, exhausted credits, runtime installation, authentication,
MCP connection, transport, and turn failures remain distinguishable and
preserve the transcript. Exhausted free credits lead to Agent Settings
and the bring-your-own choices. An installation
failure retains a no-download recheck so a CLI installed or repaired outside
StashBase can resume preparation without repeating the managed install. The
same recheck accepts a Codex login completed elsewhere. Abandoned or
interrupted output cannot arrive in a newer turn or session. A Stop racing a
native turn that has already ended clears the stale working state without
presenting a turn failure. Removing a folder is an expected scope retirement:
it never widens a started conversation to an unbound context or replaces its retained
content with a connection error.

### Evidence

See [J06 evidence](../code-review/journey-coverage.md#j06-agent).

## J07: Converge chat into a document

### Outcome

The user turns a discussion into an outline, draft, or revision in an ordinary
project file, then inspects and edits the result. Writing is implemented; the
unfinished document-specific diff concerns the later fine-revision experience.

### Entry State

A project-bound Chat contains an idea or request worth writing. The target may
be an existing editable document or a new file; no Canvas or wiki is required.

### Primary Flow

1. Brainstorm in Chat and decide what to write or change.
2. Ask the Agent to create or revise an authorized project document, or create
   a draft and begin editing directly.
3. Open the result beside the conversation when useful. Inspect the text and
   available Agent file-change information, then continue writing or revising.
4. Save editor changes through the ordinary version/conflict path. Agent writes
   are already file operations governed by their permissions and transaction
   rules; displaying their diff is not a separate universal acceptance gate.
5. Continue the discussion or return to the document in later work.

### Required Observable Results

- Discussion alone does not automatically create a file or copy its transcript
  into the project. A user request may authorize drafting as well as recording
  settled conclusions.
- Writes target an explicit authorized file and preserve the shared path,
  version, and lifecycle rules.
- Agent-created or changed files refresh the workspace without selecting
  themselves or replacing user focus.
- Existing editor and Agent comparisons describe the changes they actually
  represent. They do not claim the incomplete document-specific diff or a
  generic accept/reject workflow that the product does not provide.
- Drafts and revised documents remain ordinary user-owned files, available to
  other tools and later project context when their format is eligible.

### Degradation and Recovery

Failed, interrupted, unauthorized, or conflicting writes do not manufacture a
successful document. The user can inspect the result and retained conversation
before continuing. The editor's conflict flow keeps the dirty buffer and newer
disk content distinct. Nothing automatically merges conversation branches into
an accepted final document.

### Evidence

See [J07 evidence](../code-review/journey-coverage.md#j07-converge). File-write and
editing evidence does not prove the unfinished refinement diff.

## J08: Connect an external Agent through MCP

### Outcome

An MCP-capable client uses the same authorized project operations and visible
source identity as OpenQuill.

### Entry State

The user has authorized at least one project folder and has an external
MCP-capable client to configure.

### Primary Flow

1. Copy the standard configuration or URL access details from Settings and
   register them in the client.
2. Orient with project information, select one Folder for each search, then
   search or read authorized files.
3. Use bounded mutations when the client needs to write back.
4. Reindex or reconcile external changes when required.

### Required Observable Results

- OpenQuill and external Agents use the same operation and source-identity
  rules.
- `read_file`, `write_file`, and `edit_file` advertise and enforce the format
  capabilities in the
  [Documents matrix](design/documents.md#format-capability-matrix); a generic
  claim that every previewable source is text-readable or content-editable is
  invalid.
- Paths outside member folders and hidden derived state remain inaccessible.
- Search narrowing fails rather than silently widening.
- File mutations use the shared version and lifecycle boundaries.

### Degradation and Recovery

Configuration, credential, listener, or transport failure does not broaden
filesystem access or block ordinary app use. Rotation and recovery invalidate
obsolete access rather than maintaining competing authority.

### Evidence

See [J08 evidence](../code-review/journey-coverage.md#j08-external-mcp).

## J09: Prepare and hand off a bug report

### Outcome

The user prepares an actionable local report, reviews exactly what may be
shared, and remains the only party who submits it.

### Entry State

The user deliberately opens Report a bug from Settings, under General, or from
the native Help menu. The main workspace renderer may be healthy or impaired.

### Primary Flow

1. Describe the problem and optional reproduction steps in the dedicated review
   window.
2. Inspect safe previews and independently include or exclude each available
   artifact.
3. Choose **Prepare Report** to freeze the reviewed snapshot locally.
4. Open a prefilled GitHub issue after copying the files to Downloads, or
   download the same files without opening GitHub.
5. Go Back to revise and approve a fresh snapshot, or close to discard the
   session.

### Required Observable Results

- Collection, approval, and every external handoff require deliberate actions.
- Previewing an artifact never changes whether it is selected.
- Preparation uses exactly the approved text and artifacts and never
  recollects changing inputs.
- Nothing is uploaded or submitted by StashBase.

### Degradation and Recovery

An unavailable or privacy-unsafe artifact fails closed without exposing
private content or discarding the rest of the draft. A late result cannot
revive a closed or discarded review.

### Evidence

See [J09 evidence](../code-review/journey-coverage.md#j09-bug-report).

## J10: Turn a local project into durable Agent-assisted work

### Outcome

A person enters a project, develops an idea through discussion, and can write
and refine ordinary documents in the same working context. Brainstorming and
writing are implemented; document-specific diff for fine revision remains
incomplete.

### Entry State

An existing or newly created project is open. It may be empty. The person has
an idea, question, existing draft, or reference material and chooses a
supported Agent with its required readiness and authentication.

### Primary Flow

1. Enter the project without migrating its files or waiting for indexing.
2. Start or continue a project-bound Chat to brainstorm, compare alternatives,
   and develop the idea. Opening a source or searching is optional.
3. When the discussion benefits from references, read or retrieve authorized
   project material. Preparation supports eligible formats in the background.
4. When ready to write, ask the Agent to draft or revise a file, or create and
   edit a document directly. Opening it can dock the same Chat alongside it.
5. Inspect the text and current change information, make ordinary edits, and
   resolve any save conflicts. Dedicated document-diff refinement is not yet a
   completed part of this step.
6. Continue the conversation or reopen its history and documents for later
   work. New writing can become reference material in the same project.

### Required Observable Results

- A project with no source files can carry a useful discussion. Building a
  wiki, retrieving evidence, and writing a document are not entry requirements.
- Project, conversation, document, and retrieval identities remain attributable
  through the transitions; work never silently broadens to another folder.
- Background preparation and optional meaning-based indexing do not block
  discussion unrelated to those pending sources or ordinary document work.
- A conversation can remain exploration. Writing follows a user request or
  direct edit and the applicable permission rules; it is not inferred merely
  from opening a Chat or receiving an answer.
- Existing drafting, editing, Agent change reports, and conflict recovery stay
  useful while document-specific diff is unfinished.
- Written content remains in ordinary files, and any derived reference text
  stays invisible while resolving to its visible source.
- Loss of Agent or semantic availability does not remove access to existing
  local documents or silently discard current work.

### Degradation and Recovery

Project entry, Agent setup/turns, reference preparation, and file writes report
their own failures. A failed stage does not corrupt project files, erase the
conversation, or treat partial output as accepted content. The user can retry
that stage or continue other local work.

### Evidence

See [J10 evidence](../code-review/journey-coverage.md#j10-core-loop). This flow
composes J02 and J06, with J03/J07 for writing and J04/J05/J08 when reference
or external-Agent work is used. Prior source-first passes do not establish the
empty-project discussion path; evidence for that path must be identified
separately. Future document-diff evidence is outside current completion claims.

## J11: Turn a conversation into a project

**Role:** retained secondary contract. The underlying creation and rebind
boundary exists, but its unbound in-app entry is not exposed. It is not the
project-first main flow, and retaining this record does not add an unbound Chat
to the remaining feature roadmap.

### Outcome

An exploratory unbound Chat becomes a named ordinary local project only after
the user decides the work deserves a durable scope. The same conversation
continues inside the new project without losing its history or silently
copying the transcript into source files.

### Entry State

The user is in a live unbound Chat that is not already bound to one
member folder. The conversation has produced a direction worth continuing,
but no project folder or durable project document is assumed.

### Primary Flow

1. Explore a question, idea, or task in the reusable unbound Chat.
2. Explicitly tell the Agent to turn the work into a project, optionally naming
   an authorized location.
3. The Agent uses the StashBase `create_project` operation rather than a bare
   filesystem command.
4. StashBase creates one new empty ordinary folder under the default folder
   home or another authorized root and registers it in the project registry. It does
   not seed instruction files.
5. The live initiating unbound Chat keeps its transcript, changes scope to the
   new project, and causes its owning window to enter that folder. Other
   windows observe Project registration without being redirected.
6. Continue the same conversation against the new project and explicitly write
   accepted goals, decisions, or plans into ordinary source files when they
   need to persist.

### Required Observable Results

- Project creation follows an explicit user decision or a visible approval
  naming the action and target; StashBase never infers consent merely because
  a conversation resembles a project.
- The created project is an ordinary, newly created local folder. Its name is
  one cross-platform-safe segment, its resolved location remains inside an
  owned root, and an existing destination is a conflict rather than a folder
  to reuse or overwrite.
- Existing `AGENTS.md`, `CLAUDE.md`, and other runtime-native instruction files
  are never created, migrated, or overwritten. Folder-scoped Agent
  Instructions can be added later from the Chat scope menu.
- Only the live, attributable unbound Chat that initiated creation may rebind.
  A folder-bound, stale, unattributed, or external caller may create and
  register an authorized project but cannot redirect an unrelated built-in
  Chat.
- Rebinding preserves transcript, draft, session identity, and history
  attribution while changing future tool and file access to the new folder.
- The new registered project and active scope remain visibly attributable. The
  conversation is not copied into project files automatically; durable content
  enters the project only through an explicit write.

### Degradation and Recovery

Invalid names, unauthorized locations, symlink escapes, and existing targets
fail before modifying disk. If Project registration cannot commit, StashBase
removes only the newly created empty directory it still owns. If the initiating
session closes or rebinding races with teardown, the project remains a normal
registered folder while stale history overrides are rolled back. If history
ownership cannot be saved, creation still succeeds but the Chat keeps its
previous scope; the result explains that the user can open the project and
start a new Chat. If the
originating window cannot enter a successfully rebound project, the Chat keeps
the new scope visible and reports a retryable open failure rather than
reverting to an ambiguous unbound Chat presentation.

Known Gap: no window shows an unbound Chat, so this journey's entry
state cannot be reached from the product. Project creation still works for an
attributed MCP caller. The owning gap is
[No surface for an unbound Chat](design/agent-panel.md#no-surface-for-an-unbound-chat).

Known Gap: an OpenQuill chat updates its live scope and keeps using the
attributed MCP connection, but OpenCode does not yet migrate the same native
session record and cwd to the project. Its restored history remains under
Projects and native folder commands require a new folder-scoped chat.

### Evidence

See [J11 evidence](../code-review/journey-coverage.md#j11-conversation-to-project).
This Journey composes the Chat entry from J01, project registration and entry
from J02, Agent lifecycle from J06, explicit persistence from J07, and the
durable continuation described by J10.

## J12: Build Wiki Pages from a local folder

### Outcome

An existing local folder gains visible, source-linked Wiki Pages that make its
Sources easier for people and Agents to navigate without replacing or
reorganizing them. Setting up search by meaning may independently make the
same Sources and Wiki Pages retrievable even when the wording differs.

### Entry State

The user has opened a project folder and is in a blank folder-scoped Chat. The
folder may contain no Wiki Pages, or it may already have pages under `wiki/`.
Search by meaning may or may not have been turned on; selected Agent
readiness may be absent.

### Primary Flow

1. In the blank folder-scoped Chat, write the Build Wiki request — typed
   directly, taken with **Tab** from the composer's placeholder while it shows
   **Build a wiki for docs**, or reused from a Gallery entry's **Agent
   Instructions** via its **Copy**. Tab inserts a draft; Gallery copies to the clipboard and requires a
   user paste. Neither sends a request.
2. Send it. The visible request is exactly what the Agent receives; the
   durable Wiki Pages contract (write scope, linking, maintenance) comes
   from Agent Instructions. Setup for search by meaning neither opens nor
   blocks the send.
3. If the selected Agent still needs installation or sign-in, complete that
   stage first; the composer keeps the request while the gate stands, and a
   Chat no turn has left follows the first runtime that becomes ready. The
   request is never sent on the user's behalf when the gate lifts.
4. The Agent inspects the folder and creates or improves linked pages under
   `wiki/`, following the requested layout and existing conventions. A request
   can name `wiki/index.md`; the packaged default does not mandate that filename.
5. Review the resulting files and the Agent's summary of changed Wiki Pages
   and uncovered Sources.

### Required Observable Results

- The visible transcript records the concise user intent while the Agent
  receives the stable safety and output contract.
- A wiki-building request follows its declared output scope and the existing
  wiki's conventions. It does not by itself authorize source reorganization.
  Page placement guidance is distinct from enforced project permissions.
- Building Wiki Pages and activating search by meaning can succeed
  independently. Skipping or failing that activation does not discard the
  Build Wiki request.
- Wiki Page Markdown is ordinary visible content and re-enters browsing,
  keyword search, semantic indexing, and future Agent work. Machine-derived
  text, chunks, and vectors remain invisible AppData.
- The implemented workflow has no persistent built, ready, or stale Wiki
  state. A folder that already has pages under `wiki/` cycles the same
  request in the same wording — it never becomes Update Wiki Pages — and
  nothing schedules background Wiki Page rewriting.

### Degradation and Recovery

Setup state for search by meaning does not affect building Wiki Pages.
Agent setup failure keeps the composer draft visible beside the gate's
stage-specific recovery. A partial Agent write remains an ordinary,
inspectable file transaction and never authorizes source reorganization.

Implementation boundary: Wiki Instructions guide placement under `wiki/`;
they are not a separate filesystem sandbox. The actual access boundary is the
project and permission mode. Evaluating an Agent's adherence to the requested
output scope requires Agent evidence, not just a successful file-write test.

### Evidence

See [J12 evidence](../code-review/journey-coverage.md#j12-build-wiki-pages). This
journey composes J02 folder scope, J06 Agent lifecycle, and J07 ordinary file
writeback. J05 search by meaning is optional and independent.

## J13: Download a ready-made Wiki from the Gallery

### Outcome

A user browses curated, ready-made Wikis, understands what one contains and
how it was built before taking it, and lands in a working copy — a real
folder in the project registry, open in its own window — without any setup, sign-in,
or folder being open first.

### Entry State

Any window. A window with no folder open shows the welcome screen, which
carries the Gallery band under its folder choices; a folder window reaches
the same Gallery through its sidebar row as an overlay. Network may be
unavailable.

### Primary Flow

1. **Browse.** The Gallery renders immediately from the app's bundled
   snapshot; the published index replaces it when the network answers.
   Every entry is a real public folder with a wiki built from it.
2. **Inspect.** A card opens the entry's detail page: **About** is the
   publisher's own introduction, why the wiki was made, what it holds, and
   who it is for; **Agent Instructions**, folded beneath it, unfolds to the
   exact request the wiki was built with, with a **Copy** glyph on it;
   published screenshots preview the result.
3. **Take a copy.** **Make a copy** downloads the entry's public repository
   into the folder home through the existing public-GitHub import and opens
   the copy in a new window. The shop window stays put for the next entry.
4. **Continue.** The copy is an ordinary project folder: browse its wiki,
   chat over it, or reuse the copied prompt on a folder of your own.

### Required Observable Results

- Browsing and downloading need no open folder, no account, and no Agent
  runtime. The band sits below the welcome screen's folder choices and never
  displaces them.
- The Gallery is read-only toward the user's data and never places or sends
  composer text; its one prompt affordance is explicit copy.
- The renderer reaches the published index and screenshots only through the
  local daemon's gallery proxy; the image proxy refuses non-gallery hosts.
- A copy is a plain folder registered in the project registry, opened in a new
  window; two clicks cannot race one download into two copies.
- With no network, the bundled snapshot still renders the shop and the
  detail page's unpublished slots state themselves without reshaping the
  page.

### Degradation and Recovery

An unreachable index falls back whole to the bundled snapshot — never a
half-parsed list. A failed download reports one visible error on the detail
page and leaves the project registry unchanged; the entry can be retried. A copy
created but not opened remains an ordinary project folder reachable through
Welcome / Recent: registration finishes before a new window is requested. A failed
registration rolls back unchanged imported content and leaves the existing
project list and current window unchanged.

### Evidence

See [J13 evidence](../code-review/journey-coverage.md#j13-gallery-download).
This journey composes J02 folder registration and window entry, and the
GitHub import path shared with the Welcome import flow.

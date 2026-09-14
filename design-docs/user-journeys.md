# User Journeys

J01 is first use; J10 is the recurring Documents/Chat workflow. The other IDs
name supporting flows, including J11's unavailable secondary entry.

Each journey inherits the [Writing Workspace](design/writing-workspace.md#experience-contract)
and [Project Context](design/project-context.md#experience-contract) boundaries
where applicable. The sections below add journey-specific outcomes and recovery;
[Journey Coverage](../code-review/journey-coverage.md) owns evidence and remaining gaps.

## J01: Complete onboarding and reach first value

A first-time user enters a project and begins useful discussion; on return,
their projects and saved work remain available.

### Flow

1. From Welcome, open/create a project or import a GitHub/Gallery copy.
2. Resolve the selected Agent's setup if needed, keeping the unsent idea.
3. Discuss the idea; later reopen the project through Recent.

### Required Results

- No reference file, wiki, search key, or document write is required for first value.
- Local browsing/editing works without an account. Setup and sending are deliberate.
- Users can distinguish their files, derived data, and context sent to services.
- Start Here is optional and never overwrites existing content or reseeds after
  deliberate removal. A fresh window starts at Welcome.

### Failure and Recovery

Failed entry preserves existing files and other windows; Agent setup failure
keeps the request and identifies its stage. Remaining wiki-first copy is recorded
under [language alignment](design/writing-workspace.md#product-language-alignment).

**Evidence:** [J01](../code-review/journey-coverage.md#j01-onboarding).

## J02: Add and open a folder

Enter an existing folder, create an empty one, or import a public GitHub
repository as an ordinary local project.

### Flow

1. Choose the folder or import destination and enter before background indexing.
2. Discuss, browse, or edit; another project opens in another window.
3. Deliberately remove a project registration when no longer needed.

### Required Results

- Original files and foreign working trees stay unchanged by project registration.
- Imports reject unsupported repositories and existing destinations, and register
  a successful copy before attempting window entry.
- Windows retain independent work. Removal preserves source files and separately
  registered nested projects; entry never creates native instruction files.

### Failure and Recovery

A failed/superseded open preserves the last valid state. Slow import is cancellable;
rollback preserves concurrent user additions/edits. A copy that cannot open remains
registered. Failed removal remains recoverable without deleting user files.

**Evidence:** [J02](../code-review/journey-coverage.md#j02-folder).

## J03: Read and edit source documents

In an open project, read files and edit formats supported by the
[format matrix](design/writing-workspace.md#format-capability-matrix).

### Flow

1. In Documents mode, create a Markdown draft or open a file.
2. Read/edit, save, and navigate between documents.
3. On returning after interruption, restore or discard surviving drafts.

### Required Results

- Views retain source identity; preview-only/generic files do not imply editing,
  retrieval, or Agent access. Unsupported bytes remain identifiable and unchanged.
- Hidden-file visibility is durable and widens browsing only; protected/derived
  state stays hidden and existing edits survive visibility changes.
- Navigation and closing preserve edits. Recovery identifies each draft and
  changed/missing source; restoring returns unsaved text, not a disk write.

### Failure and Recovery

Save failure blocks leaving; a lost save barrier requires a loss warning before
reload. Conflicts retain dirty/disk text for reload, overwrite, or merge. Recovery
is unavailable without OS key protection; current gaps are
[explicit](design/writing-workspace.md#document-trust-and-recovery).

**Evidence:** [J03](../code-review/journey-coverage.md#j03-documents).

## J04: Prepare a hard-to-read file

Make a project's PDF, DOCX, image, audio, or supported video source usable as
text evidence while keeping the original.

### Flow

1. Add/open the source and continue working while preparation runs.
2. Read, search, or supply the current prepared text to an Agent.
3. Retry/reprocess when needed.

### Required Results

- Preparation does not replace sources or block ordinary preview/unrelated work.
- PDF/OCR components download on demand in the background and later work offline.
- Only complete, current output becomes evidence; preparation and vector-index
  readiness remain distinguishable. Derived artifacts stay hidden.

### Failure and Recovery

Download failure stops for the session; retry once next launch or explicitly
from Settings. Stale/partial output is unavailable. Cancelled sources stay stopped;
missing tools leave an actionable state without turning the source into a failed file.

**Evidence:** [J04](../code-review/journey-coverage.md#j04-preparation).

## J05: Search and open source evidence

Find evidence within one selected project and open the source that supports it.

### Flow

1. Search by keyword, or by meaning after adding an embedding key in Settings.
2. Review results and any preparation/indexing/provider limitations.
3. Open a result in source context.

### Required Results

- **By keyword / By meaning** use the same project scope and visible source identity.
- Meaning-based retrieval finds relevant material beyond literal wording.
- Missing results are distinct from unavailable work; keyword search remains usable
  without embeddings. Previewability alone never makes a file searchable.

### Failure and Recovery

Known-stale evidence is withheld. Current indexed files can remain partially
useful; fixing the key resumes pending work without blocking document workflows.

**Evidence:** [J05](../code-review/journey-coverage.md#j05-search).

## J06: Start and continue an Agent chat

Start or restore an Agent conversation in a project, including an empty one.

### Flow

1. Use Chat mode or Agent assistance alongside Documents mode; choose a runtime
   and explicitly complete any installation/authentication.
2. Send the request with optional project context; inspect tools, approvals, and files.
3. Continue, edit/resend, queue/remove follow-ups, stop, or return through history.
   Optionally customize project Instructions.

### Required Results

- Setup completion never sends the draft; mode changes preserve conversation/work.
- Context and tools stay authorized and format-correct; opening a document does
  not attach it. Agent permissions remain separate from application modes.
- Instructions save for later mounts without editing native instruction files.
- OpenQuill credits belong to Agent use, not search. Attachments, steering, and
  model choices are offered only where the selected runtime supports them.
- Project removal cancels unfinished work while retaining started transcripts.

### Failure and Recovery

Distinguish setup, credits, authentication, transport, and turn failures while
retaining work. External CLI/login repair can be rechecked without downloading.
Stop/late output cannot corrupt newer work; retired scope does not offer misleading
Retry. Native/UI limits remain in [Writing Workspace](design/writing-workspace.md#known-gaps).

**Evidence:** [J06](../code-review/journey-coverage.md#j06-agent).

## J07: Converge chat into a document

Turn a project discussion into an outline, draft, or revision in an ordinary file.

### Flow

1. Decide what to write or change and ask the Agent, or begin editing directly.
2. Inspect the result and available file-change information in Documents mode.
3. Continue editing, resolve save conflicts, and return to the conversation.

### Required Results

- Discussion does not automatically publish a transcript or authorize unrelated writes.
- Files refresh without taking focus and remain usable by other tools.
- Current file/conflict comparisons do not imply pending prose suggestions or a
  universal accept/reject gate over Agent writes.

### Failure and Recovery

Failed, interrupted, unauthorized, or conflicting writes do not claim success.
Retain the conversation and distinguish dirty text from newer disk content before
continuing; no automatic merge of conversation branches becomes a final document.

**Evidence:** [J07](../code-review/journey-coverage.md#j07-converge).

## J08: Connect an external Agent through MCP

Connect an external MCP client to authorized project operations.

### Flow

1. Copy the configuration or URL access details from Settings into the client.
2. Select a project; search/read eligible sources and make authorized edits.
3. Reconcile external changes when needed.

### Required Results

- Built-in and external clients share source identity, format capabilities, and
  versioned writes; each lookup names one authorized project.
- Hidden derived state and files outside authorized scope remain inaccessible.
- A bounded read identifies its extent rather than masquerading as a whole file.

### Failure and Recovery

Configuration, credentials, listener, or transport failure cannot broaden access
or block ordinary app use. Credential rotation invalidates superseded access.

**Evidence:** [J08](../code-review/journey-coverage.md#j08-external-mcp).

## J09: Prepare and hand off a bug report

Prepare a local bug report from Settings or native Help, including when the
main workspace renderer is impaired.

### Flow

1. Describe the issue, preview safe artifacts, and choose what to include.
2. Prepare Report to freeze the reviewed snapshot.
3. Copy files to Downloads and optionally open a prefilled GitHub issue.
4. Go Back for a fresh review/approval, or close to discard the draft.

### Required Results

- Collection, approval, and handoff are deliberate; preview does not select an artifact.
- Preparation uses exactly approved text/artifacts without recollecting inputs.
- StashBase does not upload or submit the report; the user completes submission.

### Failure and Recovery

Unsafe/unavailable artifacts fail closed without discarding the rest of the draft.
Late collection cannot revive a closed review. Durable Downloads copies survive
closing the temporary report session.

**Evidence:** [J09](../code-review/journey-coverage.md#j09-bug-report).

## J10: Turn a local project into durable Agent-assisted work

The recurring writing loop: develop an idea, write when useful, and return to
continue. Start with an empty project, references, or an existing draft.

### Flow

1. Enter the project and brainstorm in Chat.
2. Consult project references when useful.
3. Request writing/revision or work directly in Documents mode.
4. Inspect/edit/save, then return to documents and conversation later.

### Required Results

- Documents/Chat transitions keep the same project and unfinished work.
- References, wiki generation, and indexing are optional; discussion need not
  produce a file. Writing follows a request or direct edit.
- Saved writing remains ordinary local content usable in later project work.

### Failure and Recovery

Entry, Agent, preparation, and save failures identify their own recovery stage.
Loss of an optional service does not erase conversation or block existing local
files. Complete-loop and writing-quality evidence is tracked separately from the
component journeys below.

**Evidence:** [J10](../code-review/journey-coverage.md#j10-core-loop).

## J11: Turn a conversation into a project

Retained secondary boundary: explicitly turn an unbound conversation into a
project. The in-app unbound entry is currently unavailable.

### Flow

1. Explicitly ask the Agent to create a project, optionally naming its location.
2. Create/register an authorized new empty folder through `create_project`.
3. Move only the initiating live unbound conversation into that project and continue.

### Required Results

- Creation follows a decision/approval, never speculative project intent.
- Existing destinations and native instruction files are not overwritten.
- Unrelated/bound/stale/external callers cannot redirect another conversation.
- Rebinding retains transcript, draft, history attribution, and explicit new scope;
  transcript content is written to files only on request.

### Failure and Recovery

Invalid targets fail without mutation; failed registration cleans only owned new
content. Failed history persistence retains the old Chat scope; failed window entry
keeps the successful new scope visible. [Unbound entry](design/writing-workspace.md#no-surface-for-an-unbound-chat)
and [OpenQuill native continuation](design/writing-workspace.md#openquill-project-rebind)
remain limitations, not commitments to add a new onboarding route.

**Evidence:** [J11](../code-review/journey-coverage.md#j11-conversation-to-project).

## J12: Build Wiki Pages from a local folder

Create or improve source-linked wiki pages in a project through requested Agent work.

### Flow

1. Draft a Build Wiki request directly, from a suggestion, or by copying a Gallery request.
2. Complete needed Agent setup and explicitly send; search setup is independent.
3. Inspect generated pages, source links, and the summary of uncovered material.

### Required Results

- Suggestions/copy/setup never send automatically; the visible request and durable
  Instructions stay distinct.
- `wiki/` pages follow requested layout and existing conventions without mandating
  an entry filename. They are ordinary files in the project lifecycle.
- Wiki guidance does not authorize source reorganization or create another sandbox.
  No automatic regeneration or persistent ready/stale wiki state is promised.

### Failure and Recovery

Setup failure keeps the request. Partial writes remain inspectable and follow
ordinary file recovery. A real Agent's adherence, completeness, and link quality
require evaluation beyond successful file writes.

**Evidence:** [J12](../code-review/journey-coverage.md#j12-build-wiki-pages).

## J13: Download a ready-made Wiki from the Gallery

Browse Gallery examples and obtain an ordinary local project copy, with no
prior project, account, or Agent setup required.

### Flow

1. Browse the bundled catalog, refreshed from the published index when available.
2. Inspect the introduction, screenshots, and generating request; copy it if useful.
3. Make a local copy and enter its project in a separate window.

### Required Results

- Browsing and copying never fill/send Chat or alter existing projects.
- A copy is registered before window entry; repeated clicks do not duplicate it.
- Offline browsing falls back to a complete bundled snapshot.

### Failure and Recovery

Download failure preserves the registry and allows retry. Registration rollback
preserves concurrent user changes. A downloaded/registered project survives failed
window opening and remains available through Recent.

**Evidence:** [J13](../code-review/journey-coverage.md#j13-gallery-download).

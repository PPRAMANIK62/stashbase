# Writing Workspace

## User Outcome

Enter an ordinary local project, discuss ideas, and write or revise documents.
An empty project is valid.

## Scope and Non-goals

Owns project entry, the Documents/Chat modes, document capabilities, Agent
collaboration, and continuity of work. [Project Context](project-context.md)
owns preparation and retrieval.

No proprietary document store, global knowledge library, automatic transcript
publication, or remote Agent execution service is introduced.

## Current Experience

### Documents and Chat modes

| Mode | Primary activity | Layout intent |
|---|---|---|
| Documents | Browse, read, draft, edit, and review project files | VSCode-like file and editor workspace, with Agent assistance alongside when useful |
| Chat | Brainstorm, ask questions, develop ideas, and work with an Agent | Claude/ChatGPT-like conversation workspace, centered on conversation and history |

Both modes share the project and preserve documents, conversation identity,
unsaved edits, and unsent requests when switching. Chat works without source
files. Opening a document does not implicitly attach it to the Agent. Working
modes are separate from Agent permissions and document reading/editing state; they do not define automatic switching rules.

### Project entry

Open a folder, create an empty project, import public GitHub content, or copy a
Gallery example. The registry remembers projects; relaunch starts at Welcome,
and explicit entry restores saved work. A window currently holds one project;
other windows share services while keeping their work independent. Optional
Start Here content seeds only a pristine default home without overwriting or
recreating deliberately removed user content. Gallery covers, detail screenshots,
and thumbnail selection work in the installed desktop app through its local
image proxy. Browsing remains available without a project or account.

### Work with project files

Create drafts, browse, navigate, edit supported formats, import, rename, and
delete. Agent/MCP tools also expose bounded moves. The matrix below distinguishes
file visibility, content editing, preparation, and Agent access. Hidden-directory
visibility is a saved preference; protected/derived state stays hidden, and
excluded infrastructure does not become recursive background work.

Versioned saves protect source bytes. Conflicts retain dirty and disk text until
a deliberate choice. Text becomes durable through ordinary saves; no separate
crash-recovery snapshots or keychain access are used. A crash can lose text that
has not reached its source file. Preview failures retain the original file's identity. Existing Agent
file comparisons and save-conflict comparisons are not the coming-soon prose diff.

### Agent collaboration

OpenQuill is included and uses account-backed model access. Claude Code and
Codex retain their own setup and authentication. Runtime/model/permission choices
follow actual capability; installation/sign-in failures retain the request, and
successful setup does not send it. Streaming, follow-ups, tools, approvals,
artifacts, and history remain attributable to the project and conversation.

Explicit context follows format capability and current-source availability.
Instructions store one scope's default or customization in Settings, resolved at
session mount. They neither edit user-owned native instruction files nor define
access control. Requested writes create ordinary project content without taking
focus. Wiki building is an optional explicit task, not project activation.

### Supporting operations

Settings configures runtime/account, local preparation, optional search, MCP,
appearance, local components, updates, and reporting. Update installation is
explicit and crosses every window's save barrier. J09 owns the bug-report flow;
[Bug Reporting](../../code-review/architecture.md#bug-report) owns collection, privacy,
review authorization, immutable approval, and local handoff. Reporting is not
telemetry or automatic submission.

Development builds expose Settings → General → Developer → Update notification
preview. Choose a state and select Preview in sidebar to close Settings, open
the left sidebar, and show the update card in its footer above Gallery. The
default is ready to install; available, downloading, installing, and failed
states are also selectable. Real update offers use this same sidebar card,
with one primary action and a top-right close icon. No secondary release-page
or Not now buttons appear. Preview actions do not invoke the updater.
The close icon or Stop preview ends the
window-local preview and reveals the current real update state.

### Basic usage statistics

Official desktop builds share a small, public event allowlist with PostHog by
default. Settings → General → Privacy explains the choice and provides the
collection switch in a single compact row, with a short purpose statement and
a View details link. Provider, event fields, and opt-out delivery mechanics live
in the linked usage-statistics guide. The writing workspace has no first-launch
statistics banner. Collection excludes all document/conversation content,
paths, account identity, raw diagnostics, and automatic recordings. Turning it
off persists the choice, discards pending usage, and attempts one disclosed final
notification before stopping; re-enabling uses a new random installation ID.
See [Usage statistics](../../docs/usage-statistics.md) for the exact event catalog
and delivery/interpretation limits. Bug reports remain a separate explicit flow.

## Format Capability Matrix

Current capabilities by source family; [terms](../glossary.md#format-capability)
qualify preview, content editing, retrieval, and Agent access separately.

| Source family | Documents mode | Retrieval text | Agent/MCP content access |
|---|---|---|---|
| Markdown | Read and edit; new drafts use Markdown | Source text | Read/write source |
| Plain text | Read and edit valid UTF-8 | Source text | Read/write valid UTF-8 |
| JSON | Source-preserving tree and text editing | Source text | Read/write source |
| HTML | Preview only | Text extracted in memory | Read/write raw HTML source |
| PDF | Source preview | Prepared Markdown | Read prepared text; no content writes |
| Image | Source preview | Prepared OCR text | Source attachments depend on runtime; MCP does not return image bytes |
| DOCX | Sanitized source preview with current prepared fallback | Prepared HTML | Read prepared text; no content writes |
| Audio | Source playback or compatible local preview | Timestamped transcript | Read transcript; no content writes |
| Video | Compatible playback or local audio preview | Audio-track transcript | Read transcript; no content writes |
| Generic file | Bounded read-only UTF-8 or an explicit unavailable state | None | Excluded from discovery, reads, and mutations |

Video-container support does not guarantee decoding of every embedded codec.

Rename and delete are file-mutation capabilities over regular files in the
active Workbench, including generic regular files, and moving a file is
reachable through Agent and MCP file tools rather than the Workbench. None of
them makes a preview-only format content-editable or widens Agent access. Restricted
filesystem entries are reveal-only. Generic bytes are never decoded lossily.

## Experience Contract

- Local files are authoritative. Entry never migrates them into managed storage,
  waits for optional indexing, or implies Agent installation/sign-in/send consent.
- Import/creation rollback preserves concurrent user changes. Successful
  acquisition stays registered if later window entry fails.
- Navigation, mode changes, window retirement, and shutdown preserve work or stop
  with an actionable failure. Another window's state cannot be retired implicitly.
- Removing a project clears only its owned state, preserves sources and separately
  registered nested projects, and never silently rebinds a started conversation.
- Failed settings reads/writes do not replace durable configuration with defaults
  or re-add deliberately removed projects.
- Source identity and declared format capability remain consistent across views,
  saves, retrieval, and tools. Invalid text is not decoded lossily; structured
  views do not create another persistence model. Hidden visibility never widens
  retrieval or Agent access.
- Conflicting writes never silently overwrite dirty or newer disk text. Saving
  does not await embeddings; failed search updates report lag, and cleared text
  cannot remain usable evidence. Save conflict handling preserves the original version boundary.
- Startup does not request a keychain or OS key-store credential. There is no
  background draft journal; auto-save and save-before-close barriers own durability.
- Discussion or presentation changes do not authorize writes or attach context.
  Requests, editable Instructions, internal routing, and permissions stay distinct.
- Surfaced approvals require deliberate user decisions. Runtime notices, automatic
  review outcomes, and failures remain distinct; failure/Stop/retirement preserves
  transcripts without admitting late output or widening scope.
- OpenQuill's token stays outside renderer/runtime state; credits do not pay for
  search. External clients and native tools follow their authorized project scope.
- Untrusted document/response content must not acquire application privileges or
  arbitrary remote access. Compatibility exceptions remain explicit below.

## Known Gaps

### Product-language alignment

Claude's frontend review still needs to align Welcome/Chat's wiki-first wording
and source-oriented starters with brainstorming and writing. Empty projects
currently have no starters but do accept typed discussion. New packaged guidance
is aligned; existing user-authored copies are not overwritten. Suggestions must
remain drafts until explicit send.

### No surface for an unbound Chat

J11's creation/rebind backend remains, but Welcome exposes no unbound Chat entry.
This is a retained secondary boundary, not a commitment to add another entry.

### A saved instruction edit waits for the next Chat

Instructions save for later session mounts, but the current UI does not explain
that an already mounted Chat keeps its initial guidance. See
[Agent Runtime](../../code-review/architecture.md#agent-sessions-and-permissions).

### OpenQuill project rebind

Live panel/MCP scope can move to a created project; OpenCode native history/cwd
cannot migrate with it. Restored history stays unbound. Codex and Claude retain
the full native continuation contract.

### Document trust and recovery

- Executable local HTML/remote subresources have a weaker boundary than required;
  [Document Viewers](../../code-review/architecture.md#document-and-window-trust) owns it.
- Unsaved text is retained while its document runtime lives. Crash or shell
  remount recovery reloads saved source files and cannot recover newer buffer text.
  See [Draft Durability](../../code-review/architecture.md#draft-durability).

Navigation and recovery limits: [J03 evidence](../../code-review/journey-coverage.md#j03-documents).
Quality and flow evidence: [Journey Coverage](../../code-review/journey-coverage.md).

## Cross-area Seams

[Project Context](project-context.md) supplies current project evidence. Engineering owners are linked below.

## Contribution Direction

[Document-specific diff](../product-direction.md#document-specific-diff--remaining-feature)
is the planned addition.

### Coordinate First

Changes to project/data ownership, format editing, permissions, context passing,
recovery trust, or diff acceptance/persistence require an explicit decision.
Mode layout can evolve without preserving old control placement, provided its
work priority and continuity remain intact.

## Related Journeys and Contracts

Journeys: [J01](../user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J02](../user-journeys.md#j02-add-and-open-a-folder),
[J03](../user-journeys.md#j03-read-and-edit-source-documents),
[J05](../user-journeys.md#j05-search-and-open-source-evidence),
[J06](../user-journeys.md#j06-start-and-continue-an-agent-chat),
[J07](../user-journeys.md#j07-converge-chat-into-a-document),
[J08](../user-journeys.md#j08-connect-an-external-agent-through-mcp),
[J09](../user-journeys.md#j09-prepare-and-hand-off-a-bug-report),
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work),
[J11](../user-journeys.md#j11-turn-a-conversation-into-a-project),
[J12](../user-journeys.md#j12-build-wiki-pages-from-a-local-folder),
[J13](../user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery).

Engineering: [boundaries](../../code-review/architecture.md) and
[journey-to-code/evidence map](../../code-review/journey-coverage.md).

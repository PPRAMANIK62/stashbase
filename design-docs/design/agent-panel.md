# Agent Panel

## User Outcome

People enter a project, brainstorm with an Agent, and use the same conversation
to draft and revise documents. These capabilities are implemented. Discussion
can be useful before any file exists; document-specific diff for fine revision
is the remaining feature, owned by [Documents](documents.md).

## Scope and Non-goals

The Agent Panel is the product capability; Chat is its visible conversation
surface. This area owns built-in Chat creation, tabs, scope selection,
transcript, composer, attachments, permissions, history, and adaptive layout.
Runtime installation, native process ownership, MCP access, and indexing have
separate engineering contracts.

The panel is not a remote Agent host, a separate AI workspace, or a
transcript-centered file manager. **OpenQuill**, the included Agent, runs locally
and uses a hosted service only as its metered model provider.

## Current Experience

### Project conversation

- Chat leads in a project with no open document. Opening a document can dock
  the same mounted conversation beside it; hiding and showing the pane keeps
  transcript and draft. Empty projects can accept a typed idea or request.
- New chat reuses a completely blank tab or starts a conversation attributed
  to the selected runtime and project. History lists that project's work,
  with reopen, rename, and delete. Project changes never silently rebind a
  started conversation.
- A user can brainstorm, ask a question, request an outline or draft, and ask
  for revisions. No source lookup or Build Wiki request is required before a
  turn. Explicit references and tools are available when the task needs them.
- Current blank-chat copy says **From wiki to words.** For a non-empty folder,
  placeholders offer wiki building, a folder question, and a blog-writing
  request. An empty folder gets no rotating source prompts but keeps the
  composer. Tab accepts a displayed suggestion as a draft and never sends it.
- Gallery remains outside Chat. Copy prompt copies to the clipboard; the user
  pastes it if desired. It neither fills nor submits a conversation.

### Runtime readiness and controls

- OpenQuill is selected initially and uses the included local OpenCode runtime
  after account sign-in. Claude Code and Codex are supported alternatives with
  their own installation, authentication, model, and capability handling.
- A runtime that cannot send shows its failing stage below the retained
  composer. Entering a project or opening history is not installation consent;
  missing bring-your-own runtimes require Install and continue. Installed
  Codex has its own provider-owned sign-in flow. Resolving a gate does not
  automatically send the draft.
- OpenQuill account controls show remaining free credits and refill timing,
  not a search quota. Stopping a browser-login wait permits another attempt
  without claiming to revoke browser authorization.
- Choosing another provider starts a new Chat rather than retargeting started
  work. Model and thinking controls follow runtime capabilities. Auto is the
  initial permission mode; supported Ask, Plan, and Edit modes remain explicit
  per-session choices. The renderer does not answer a surfaced approval itself.

### Context, instructions, and file work

- Project mentions, supported attachments, and source requests supply explicit
  context. Merely opening a document does not attach it. Format access follows
  the [Documents matrix](documents.md#format-capability-matrix); OpenQuill does
  not expose transient attachment support without a scoped byte-reading path.
- Retrieval stays in the bound project. It can use current prepared text and,
  when configured, meaning-based evidence. An omitted mode follows current
  key configuration on each lookup; explicit modes are honored. There is no
  per-Chat retrieval toggle, and lookup selection never controls background indexing.
- Instructions edits working-folder guidance in application settings. The
  packaged default supports brainstorming, requested drafting and revision,
  source-backed answers, and wiki work only when requested. An empty project
  needs no reference lookup before discussion. A saved customization applies to
  sessions mounted afterwards; an already mounted session keeps its initial
  instructions. Native `AGENTS.md` and `CLAUDE.md` remain untouched.
- Drafting and revision can create or change ordinary authorized files. The
  workspace refreshes without automatically opening the result. Reported file
  changes and existing file diffs can be inspected; they are not the unfinished
  writing-specific refinement diff or a universal approval gate over writes.
- Permission decisions follow the selected runtime and mode. Successful Auto
  reviews stay quiet; warnings, blocked reviews, tool activity, and failures
  remain distinct events.

### Continue and recover

- Streaming, tool activity, queued follow-ups, skills, and file artifacts stay
  attributable to the conversation. A queued follow-up can be removed before
  send; steering is available only for runtimes that support it.
- A settled latest prompt can be edited back into the composer and resent as
  a new turn. Live bound context can be restored; native-history attachment
  bytes are not recreated when they are unavailable.
- Removing a project's scope cancels unfinished scoped work while retaining
  started conversation state. The internal unbound boundary and native-history
  limitations are recorded below; no in-app unbound Chat entry is exposed.
- Replies render GFM, in-document anchors, and HTTP(S) links. Relative file
  links in reply prose, raw HTML, and remote images remain inert; bound context
  and file artifacts have separate navigation authority. Formula rendering and
  classified failure recovery have
  existing limitations in [Agent Panel](../../code-review/agent-panel.md#known-gaps);
  they are not claimed complete merely because the protocol carries the data.

Exact control placement and event-to-view mechanics belong in the
[Agent Panel engineering contract](../../code-review/agent-panel.md).

## Experience Contract

- A project-bound discussion can start without source files, wiki generation,
  or optional meaning-based indexing. Existing runtime readiness and permission
  requirements still apply.
- Brainstorming does not automatically write a document. A user request may
  authorize drafting and revision; file changes remain ordinary project work.

- Chat-primary and docked layouts are two presentations of the same mounted
  session. Transcript, streaming, draft, attachments, scroll, and remembered
  width survive the transition, and the transition itself is one push: the
  Chat slides across the card as a sheet, its contents moving with its edge,
  as a document opens or closes beside it or as the sidebar mode takes the
  documents away and brings them back, and the document passes under it
  whole rather than fading.
- The Chat pane names its own conversation under Documents mode. The
  titlebar carries only window-level chrome there, so opening a document
  never takes the name away and hiding the pane takes the name with it; in
  Chats mode the titlebar names the chat, because the pane is the card.
- Respect explicit visibility. Initialization opens Chat; later automatic
  layout changes do not override a user hide or reveal.
- Opening, switching, or resuming an Agent tab is not installation consent.
  The included runtime needs no install action; each missing bring-your-own
  runtime waits for its own explicit setup action.
- The Gallery never speaks for the user: its one prompt affordance is
  **Copy prompt** on an entry's detail page, and nothing the Gallery does
  places or sends composer text. Setup for search by meaning is independent
  of building a wiki and never blocks a sent request.
- Agent searches stay in the Chat's bound project. An unbound Chat cannot
  borrow a project through tool arguments, and empty results never broaden
  scope. Search scope mechanics live in
  [MCP Access](../../code-review/mcp-access.md).
- Lookup selection follows the [Search contract](search.md): explicit modes
  are honored; an omitted mode follows current key configuration. Lookup
  selection does not control background indexing or depend on Agent permission mode.
- Agent Instructions are durable working-folder metadata, not a live turn
  control or a security boundary. Save failures remain visible, the folder
  requires live project registration, and a saved change reaches every Chat
  that starts under that scope after it. Exactly one scope applies to a Chat and
  scopes never combine. A Chat resolves that scope's saved text, or that
  scope's own packaged default when it has none. An unbound scope has its own
  default, which an unbound customization may replace. The editor and its API expose only
  that user-visible text. Runtime
  Adapters preserve it exactly while composing a separate, non-user-visible
  product policy that prefers StashBase MCP for project discovery and
  prepared document reads. Product routing is never registered as if the user
  authored it.
- The user's visible request is exactly what the Agent receives. Wiki Page
  placement and maintenance behavior live in Agent Instructions rather than
  a second hidden wire prompt.
- A runtime, transport, or turn failure leaves one persistent explanation and
  a truthful, stage-specific recovery path. Retrying preparation resumes from
  the first incomplete stage. After an installation failure, **Check again**
  remains available so an external repair can be discovered without
  authorizing another download. Authentication is distinct from installation:
  in-app sign-in uses the selected Codex runtime and never handles its token,
  while **Check again** discovers a login completed elsewhere. Late output
  from an abandoned generation cannot enter a newer turn.
- A failed turn explains itself in the conversation and never blocks the
  panel: transient rate or network failures offer an in-place Try again. An
  exhausted OpenQuill credit balance opens Agent Settings to review usage or
  switch runtimes; an expired sign-in offers Codex's in-app sign-in or, for
  Claude, terminal sign-in steps with an in-place Reconnect. Either
  way the same conversation continues without restarting StashBase: acting
  on a recovery removes the stale failure card and automatically retries the
  failed message, answering when the recovery worked and showing a fresh card
  when it did not. Recovery follows the failure's classified kind, never
  message prose.
- Stop is idempotent at the user boundary. If the native runtime has already
  finished the selected turn when it receives the interrupt request, Chat
  settles the stale working state without adding a failure card.
- Runtime notices and failures remain distinct protocol facts. Successful
  automatic approval is routine activity rather than a notice; other notices
  use a polite warning presentation and stay visible when no final answer
  follows. Only failures enter startup, turn, or session recovery.
- OpenQuill uses a service-owned model profile. Its current product profile hides
  model selection, while the stable profile alias keeps later model choice and
  provider changes compatible with existing desktop builds.
- Folder-scope retirement never offers Retry or reconnects user work into a
  broader scope. In-flight tools and queued follow-ups become visibly
  cancelled, and the original Chat remains readable rather than presenting a
  transport failure.
- The selected permission mode governs which actions the runtime approves on
  its own. Every approval it surfaces — permission, deletion, command, network,
  or broader filesystem — is an explicit user decision; the panel never answers
  one itself. Tool payloads render in a human-readable form.
- unbound OpenQuill sessions reach files only through the authorized
  StashBase MCP operation layer. Folder-scoped sessions may use OpenCode's
  native local tools inside that folder; commands, edits, network, and any
  broader access retain their configured approval or denial.
- Agent copy and tool affordances describe the actual source or prepared
  representation and never advertise a broader format capability than the
  selected surface provides.
  Prepared context remains usable only while its source exists and the
  preparation is current and complete; an old attachment cannot keep deleted
  or superseded extracted text readable.
- Streaming does not steal the reading position of someone inspecting earlier
  content.
- Agent response Markdown treats raw HTML and remote images as inert; only
  validated workspace links and HTTP(S) links are active.
- Discovering and invoking a runtime skill never installs, edits, or exposes
  the skill implementation through the composer.
- Turning an unbound conversation into a project follows an explicit user
  decision. The same Chat may rebind to the newly registered ordinary folder;
  later tool and file work uses that project as its working folder while native
  session identity and transcript remain continuous. The transcript is never
  copied into source files without a separate explicit write.

## Cross-area Seams

- [Workspace](workspace.md) owns the current folder, source tabs, and shell.
- [Documents](documents.md) owns source editing beside Chat.
- [Search](search.md) owns retrieval identity and readiness.
- [Agent Runtime](../../code-review/agent-runtime.md) owns native lifecycle.
- [MCP Access](../../code-review/mcp-access.md) owns Agent file boundaries.

## Known Gaps

These record implementation limits, product-language alignment, or evidence
issues in existing capabilities. They do not add unfinished product features
to the roadmap; document-specific diff is the remaining feature.

### Product-language alignment

Current greetings and source-oriented placeholder requests retain wiki-first
language and can understate the empty-project brainstorm and writing path.
The packaged project Instructions and newly seeded Start Here guide now lead
with discussion and requested writing. Existing user-customized Instructions
and already seeded guide copies remain user-owned and are not overwritten.
The remaining UI wording does not describe a prerequisite in the runtime.

### No surface for an unbound Chat

The unbound scope is implemented end to end, with its own packaged Agent
Instructions for discussion and explicitly starting a project; it has no
project-file access before binding. No window shows it. This is a retained secondary runtime boundary, not a
requirement to add another onboarding path. A window with no folder open shows the welcome
screen instead of a Chat, and a folder window's Chats panel lists only that
folder's conversations. So an unbound conversation cannot be started or
returned to, which leaves
[J11](../user-journeys.md#j11-turn-a-conversation-into-a-project)'s entry
state unreachable from the product and hides a blank Chat that has returned to
unbound scope after its folder was removed.

### A saved instruction edit waits for the next Chat

The editor opens from the composer, so a reader always edits from inside an
open Chat and expects the Chat in front of them to work under the text they
just saved. Adapters inject the resolved instructions once, when a native
session mounts, and none of them grows a live setter, so nothing carries a
save into a mounted conversation and nothing remounts one. No surface names
that limit, so a reader meets the delay rather than expecting it. See
[Agent Runtime](../../code-review/agent-runtime.md) for the Adapter side.

### No control for meaning-based Agent retrieval

The contract above treats a Chat's use of meaning-based evidence as live
session policy the user owns. Nothing offers that choice. Every Chat keeps
meaning-based retrieval on whenever a source is configured, so the only way to
constrain a lookup to text matching is for the Agent to ask for it.

### OpenQuill project rebind

An attributed OpenQuill unbound chat can create a project and move its
live panel scope to that folder. OpenCode cannot yet move the same native
session record to a different directory project, so the restored history row
remains under unbound history and that continued chat stays on MCP-only file access.
Codex and Claude Code retain the full native cwd and history migration contract.

## Contribution Direction

### Next

Maintain the implemented brainstorm-to-writing workflow, runtime continuity,
context handling, and recovery. Align existing product language with the
project-first purpose. Coordinate with Documents on the unfinished
[document-specific diff](../product-direction.md#document-specific-diff--remaining-feature)
without treating existing drafting or revision as future work.

### Coordinate First

- Permission policy, auto-approval, tool execution, or filesystem scope.
- Session lifecycle, history identity, or new context-passing behavior.
- MCP, indexing, or file behavior added only for panel presentation.

### Not Planned

- A second knowledge store or remotely hosted Agent execution/session service.
- Implicit current-document context.
- Presentation that weakens explicit access or recovery decisions.

## Related Journeys and Contracts

Journeys: [J01](../user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J06](../user-journeys.md#j06-start-and-continue-an-agent-chat), and
[J07](../user-journeys.md#j07-converge-chat-into-a-document), plus
[J12](../user-journeys.md#j12-build-wiki-pages-from-a-local-folder) and
[J13](../user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery). The primary
project-to-discussion-to-writing route is the
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop. The retained secondary unbound creation boundary is
[J11](../user-journeys.md#j11-turn-a-conversation-into-a-project).

Contracts: [Agent Panel](../../code-review/agent-panel.md),
[Agent Runtime](../../code-review/agent-runtime.md),
[Settings and Config](../../code-review/settings-config.md), and
[MCP Access](../../code-review/mcp-access.md). Agent writes additionally cross
[File Transactions](../../code-review/file-transactions.md); use the canonical
route for [J07](../../code-review/journey-coverage.md#traceability-map).

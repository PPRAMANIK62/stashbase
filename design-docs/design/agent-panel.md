# Agent Panel

## User Outcome

People collaborate with the included or a bring-your-own local Agent against an
explicit library or folder scope, then bring durable results back into ordinary
local files.

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

- Chat begins expanded in a folder window. With no document it is the primary
  work surface; opening a source docks the same mounted session beside it, and
  closing the last source expands an open Chat again.
- A blank Chat keeps the durable greeting **Your Wiki is here.** and offers at
  most three starters below the composer, **Build my wiki** first. The
  greeting, composer, and starters remain one vertically centered action
  group, and the first sent turn replaces them with the transcript. Starting a
  wiki over the user's own files is a plain conversation. The user asks in the
  composer, and the durable Wiki behavior lives in Agent Instructions, so the
  visible request is exactly what the Agent receives. A starter fills the
  composer and never sends, and so does **Copy prompt** on a Gallery entry's
  detail page.
- A runtime gate is a notice beneath the composer naming each runtime that
  cannot carry a turn by its own stage, never a screen in place of the
  request. A gated Chat keeps its composer, holds whatever is written into it,
  and carries that request onto the runtime that arrives, while the starters
  give their row to the gate's own recovery. Nothing is sent for the user, so
  the gate lifting leaves the request in the composer to read and send.
- The Gallery is not part of Chat. It is the band on the welcome screen a
  window with no folder open shows, and the overlay the sidebar's **Gallery**
  row raises inside a folder window. See [Workspace](workspace.md) for the
  shop's two forms and the no-folder contract.
- Agent retrieval adds meaning-based evidence on top of text matching whenever
  a source for search by meaning is configured, and uses text matching alone
  when none is. The Agent chooses the strategy for each lookup rather than
  being told once, and either strategy keeps direct and prepared document text
  reachable.
- **Instructions** sits in the composer beside the Agent's own settings. It
  edits the active Chat's scope, the concrete working folder, named in its
  title, and a quiet dot shows when that scope has replaced its packaged
  default. The dialog explains that every Chat in the scope starts with the
  text and that open Chats pick it up on their next conversation, and it
  offers **Restore default** once the scope is customized.
  The editor saves in StashBase rather than the source tree, and saving takes
  effect from the next message in every open Chat already using that folder,
  not only in Chats started afterwards. The editor opens from the composer, so
  there is always an open Chat that a new-Chats-only rule would exclude. A
  Chat mid-turn applies it once that turn settles. The plain-language packaged
  default contains every StashBase-owned behavior: search the Wiki when an
  answer may depend on the user's work, answer briefly and name source files,
  offer to make specific changes surfaced in discussion, keep Wiki Pages under
  `wiki/`, and maintain an existing Wiki's conventions and affected links.
  Clearing and saving restores that default. Existing `AGENTS.md` and
  `CLAUDE.md` files remain separate user-owned runtime inputs and are never
  changed.
- New users start with **OpenQuill** selected. The Agent is chosen in the
  composer, from a control that names the current provider, beside the model
  and thinking controls for the same Agent. Choosing a different provider
  starts a new Chat rather than repointing the current one, and all three
  controls stop taking input while a turn streams. OpenQuill's pinned
  OpenCode runtime is included with the app, requires no Agent installation or
  model API key, and becomes ready after StashBase account sign-in. Settings
  shows the remaining percent and reset time for the current fixed seven-day
  allowance window, with token detail available on demand, and keeps Codex and
  Claude Code as explicit alternatives. It never exposes the allowance's
  dollar value.
- **New chat** is the deliberate creation entry and reuses a completely blank
  tab. It sits at the top of the sidebar's Chats panel, where it becomes
  **Set up an Agent** while no runtime is ready, and as a button beside the
  sidebar toggle in the titlebar, which starts the same chat and waits,
  disabled, while no runtime is ready. The panel below it groups the folder's
  conversations by day, newest first, merging restored history with open tabs
  and omitting allocations that hold no work. A row renames in place and its
  menu offers deletion. Opening the app, a folder, a tab, or history never
  grants runtime-installation consent; a missing bring-your-own runtime waits
  for **Install and continue**.
- An installed but signed-out Codex runtime stops at a dedicated sign-in gate.
  **Sign in with ChatGPT** runs that same discovered executable's official
  browser flow; completion resumes preparation without another installation.
- Every conversation is scoped to Library or one member folder. Drafts,
  attachments, content, and resumed history freeze that scope, while folder
  switching preserves started work. The Chats panel lists the active folder's
  conversations, so work started in another folder stays mounted without being
  listed there. History remains attributable to its Agent and home scope.
- Removing a conversation's folder is an expected scope retirement, not a
  transport failure. A completely blank Chat silently returns to Library
  scope. A Chat with a draft, attachment, queued follow-up, transcript, active
  turn, or resumed identity keeps that work visible, says the folder was
  removed and the transcript is preserved, and reports how many queued
  messages were cancelled with it.
- Runtime capabilities determine model, permission, and effort controls without
  rewriting global CLI defaults. New sessions start in Auto, where the agent
  decides when an action needs approval. Ask, Plan, and Edit are explicit
  per-session picks.
  A fresh Codex chat shows Default until its native thread reports the model it
  actually started with; the catalog's suggested default is not presented as
  live session state.
  An idle Codex conversation can change the model used by its next turn without
  replacing its native thread; the picker pauses while a turn is active. Claude
  keeps its selected model fixed after the conversation has content.
- Streaming, tool activity, permissions, runtime-supported attachments, skills, recovery, and
  file artifacts remain inspectable. Collapsed tool summaries omit exact
  counts while using grammatical singular or plural category labels. Editing
  and resending an earlier prompt stops conflicting active work before
  beginning the new turn.
- A follow-up submitted during an active turn waits visibly. The user may
  delete one waiting follow-up before it is sent without interrupting the
  active turn or removing its queued siblings; runtimes that support steering
  also offer **Steer** for that waiting item.
- OpenQuill normalizes OpenCode streaming, tools, permission requests,
  native session history, and file Diffs into the same panel contract. Each
  live panel session has an independently attributed local runtime and MCP
  connection. Each user-submitted prompt also establishes one turn identity;
  every model call caused by that prompt, including tool-follow-up calls, is
  attributed to that turn until it settles.
- Successful automatic approval reviews stay quiet in Auto. A blocked,
  interrupted, or failed automatic review remains inspectable alongside
  skill-context and configuration warnings as a non-fatal notice. These
  advisories do not close Chat, fail a turn, or masquerade as
  recovery-requiring errors.
- Bring-your-own Agents preserve user-visible Unicode attachment filenames
  from selection or drop through the sent transcript and restored history.
  OpenQuill does not advertise transient attachments until its isolated
  OpenCode runtime has a scoped byte-reading path; Library mentions and MCP
  context remain available.
- Source and attachment access follows the
  [Documents format matrix](documents.md#format-capability-matrix). OpenQuill
  image attachment behavior does not imply that every external MCP client can
  read image bytes, and previewability does not imply content-write access.
- Document context is explicit. Agent-created files refresh the workspace but
  open only when selected; project creation rebinds only an attributed eligible
  library chat.
- Responses support GFM and local math rendering while preserving original
  Markdown for history and copy. Raw HTML, remote images, unsafe links, and
  invalid formulas remain inert or visibly recoverable.
- Hovering a turn reveals when its messages happened — beside the user
  message's copy/edit cluster and the reply's standing copy control. Times
  appear only when genuinely recorded (live sends and settles, or history
  whose source kept them); nothing is invented for restored transcripts.

## Experience Contract

- Chat-primary and docked layouts are two presentations of the same mounted
  session. Transcript, streaming, draft, attachments, scroll, and remembered
  width survive the transition.
- Respect explicit visibility. Initialization opens Chat; later automatic
  layout changes do not override a user hide or reveal.
- Opening, switching, or resuming an Agent tab is not installation consent.
  The included runtime needs no install action; each missing bring-your-own
  runtime waits for its own explicit setup action.
- The Gallery never speaks for the user: its one prompt affordance is
  **Copy prompt** on an entry's detail page, and nothing the Gallery does
  places or sends composer text. Setup for search by meaning is independent
  of building a wiki and never blocks a sent request.
- Agent searches default to the current Chat scope. Searching the whole
  Library from a folder Chat is explicit; empty results do not broaden the
  search automatically. Search scope mechanics live in
  [MCP Access](../../code-review/mcp-access.md).
- Whether a Chat may add meaning-based evidence to a lookup is live session
  policy, not Agent permission mode. Leaving it off keeps prepared PDF and
  document text searchable and never alters background indexing.
- Agent Instructions are durable working-folder metadata, not a live turn
  control or a security boundary. Save failures remain visible, the folder
  requires live library membership, and changes reach matching open folder
  Chats from their next message. Exactly one scope applies to a Chat and
  scopes never combine. A Chat resolves that scope's saved text, or that
  scope's own packaged default when it has none. Library scope has its own
  packaged default, which
  a Library-wide customization may replace. The editor and its API expose only
  that user-visible text. Runtime
  Adapters preserve it exactly while composing a separate, non-user-visible
  product policy that prefers StashBase MCP for library orientation and
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
  exhausted OpenQuill allowance opens Agent Settings to review usage or
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
- OpenQuill uses a service-owned model profile. The first release hides
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
- Library-wide OpenQuill sessions reach files only through the authorized
  StashBase MCP operation layer. Folder-scoped sessions may use OpenCode's
  native local tools inside that folder; commands, edits, network, and any
  broader access retain their configured approval or denial.
- Agent copy and tool affordances describe the actual source or prepared
  representation and never advertise a broader format capability than the
  selected surface provides.
- Streaming does not steal the reading position of someone inspecting earlier
  content.
- Agent response Markdown treats raw HTML and remote images as inert; only
  validated workspace links and HTTP(S) links are active.
- Discovering and invoking a runtime skill never installs, edits, or exposes
  the skill implementation through the composer.
- Turning a Library conversation into a project follows an explicit user
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

### No surface for a Library-scoped Chat

Library scope is implemented end to end, with its own packaged Agent
Instructions oriented toward locating work across folders and starting new
projects. No window shows it. A window with no folder open shows the welcome
screen instead of a Chat, and a folder window's Chats panel lists only that
folder's conversations. So a Library-scoped conversation cannot be started or
returned to, which leaves
[J11](../user-journeys.md#j11-turn-a-conversation-into-a-project)'s entry
state unreachable from the product and hides a blank Chat that has returned to
Library scope after its folder was removed.

### No control for meaning-based Agent retrieval

The contract above treats a Chat's use of meaning-based evidence as live
session policy the user owns. Nothing offers that choice. Every Chat keeps
meaning-based retrieval on whenever a source is configured, so the only way to
constrain a lookup to text matching is for the Agent to ask for it.

### OpenQuill project rebind

An attributed OpenQuill Library chat can create a project and move its
live panel scope to that folder. OpenCode cannot yet move the same native
session record to a different directory project, so the restored history row
remains under Library and that continued chat stays on MCP-only file access.
Codex and Claude Code retain the full native cwd and history migration contract.

## Contribution Direction

### Next

- Improve transcript scanning, tool summaries, and file-change presentation.
- Improve attachment, mention, and focused context handoff.
- Clarify runtime, recovery, settings, and context diagnostics.
- Continue refining the compact, low-chrome adaptive layout.

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
[J13](../user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery). The complete
source-to-Agent-to-source route is the
[J10](../user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop. A Library Chat becomes a new durable project through
[J11](../user-journeys.md#j11-turn-a-conversation-into-a-project).

Contracts: [Agent Panel](../../code-review/agent-panel.md),
[Agent Runtime](../../code-review/agent-runtime.md),
[Settings and Config](../../code-review/settings-config.md), and
[MCP Access](../../code-review/mcp-access.md). Agent writes additionally cross
[File Transactions](../../code-review/file-transactions.md); use the canonical
route for [J07](../../code-review/journey-coverage.md#traceability-map).

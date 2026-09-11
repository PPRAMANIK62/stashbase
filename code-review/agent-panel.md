# Agent Panel

> Renderer contract for the Agent conversation surface: session and tab state,
> the composer and its bound context, the transcript, permissions, per-scope
> Agent Instructions, and the chats list. Native process behavior lives in
> [Agent Runtime](agent-runtime.md).

The feature is `renderer/src/features/agent/`. It reaches the daemon only
through the Ports in `renderer/src/features/agent/application/ports.ts`, and
`renderer/src/app/` is the only place its barrel is read. No Agent module may
import a sibling feature.

## Session and Workspace State

- One window owns one Agent workspace. It holds the tab list, which session
  each tab is bound to, and the window folder those bindings follow. A tab row
  is a projection of its mounted session: bound runtime, scope, phase, title,
  recency, blankness, and whether the conversation has content.
- A conversation's transport state is one discriminated union, not independent
  flags. `draft`, `restoring`, `connecting`, `reconnecting`, `live`, `closed`,
  `failed`, `retired`, and `disposed` are the whole set, and the running turn
  lives inside `live`, so a failed connection cannot also be mid-turn.
- Unstarted means no native session, no transcript, and no active turn. Blank
  means unstarted and holding nothing the reader typed, dropped, or armed.
  Those two selectors decide reuse. **New chat** reuses a blank session in
  place, remounting under the same tab id when its runtime or scope has to
  change, and never takes over a started conversation.
- A blank session follows the window's folder. The first work a reader puts in
  it pins the binding. A session with content stops following and keeps the
  scope it had.
- A conversation no turn has left follows the runtime that becomes ready. When
  the catalog reports a ready runtime the bound one is not among, an unstarted
  session is remounted onto it and the draft plus its bound library sources
  move across. Transient uploads do not, because they are bytes the replaced
  session held while a source is a path any runtime can read back.
- A scope is `{ kind: 'library' }` or one absolute member folder path. One
  function spells that identity, so the instructions editor's read key and the
  socket's `scope` parameter cannot disagree. Library is a literal, which is
  unambiguous only because folder scopes are absolute; the route refuses a
  relative one for the same reason.
- Work that spans an `await` captures its scope first and refuses its own
  completion once the conversation has moved. A send, an attach, a replay, and
  a history mutation all run under that guard, so a completion arriving after a
  folder switch is dropped rather than applied to the folder now on screen.
- Folder removal retires only the sessions bound to that member. A blank one
  remounts in place under Library scope. One holding any work keeps its
  transcript, cancels its running tools, states how many queued messages went
  with the folder, and settles into a retired state with no composer.
- History is native-runtime truth, read per runtime for the active scope. A
  conversation row is one open tab, one history entry, or both matched by
  runtime and native session id. Rows group by local day and order by recency,
  and opening or replaying a chat never promotes it in that order.

## Layout and Visibility

- The Agent pane and the document slot are one always-mounted row. Opening the
  first document changes widths only, so the Agent workspace never remounts and
  keeps its transcript, draft, scroll position, and focus.
- The Agent pane takes the remembered session width bounded by the pane's
  declared range; the document keeps a floor of its own and the Agent yields,
  which is what makes a narrow window collapse the chat rather than crush the
  page being read. With no document open the slot is zero wide and inert.
- Only the seam moves. Both panes sit at their final widths from the first
  frame, the transition runs only when a document opens or the last one closes,
  and reduced motion lands every change at once. The splitter exposes
  keyboard-accessible value semantics.
- The Chat pane names its own conversation. `ChatHeader` at the top of the
  workspace reads the mounted session's title and Agent, renames it in place
  once the session has started (`agentSessionIsUnstarted` decides; an
  unstarted Chat's name is static text), and, once the session has a native
  identity, keeps the name on record
  through the same `renameHistory` mutation the Chats panel's rows use,
  rewriting the cached listing rather than refetching it; a refusal restores
  the previous title. The titlebar carries document tabs while any document
  is open and is otherwise empty for a folder window. Its new-chat button is
  the feature's own `NewChatButton`, so the titlebar and the Chats panel
  share one preferred-Agent rule and one `newChat` call.
- Both Agent surfaces load behind one lazy boundary with a retry, so a chunk
  that fails offers to reload itself instead of taking the window down.

## Composer and Controls

- The composer is present in every state a conversation can be in except
  retired and disposed. It holds a draft, its bound context, and its queue
  whether or not a runtime can carry a turn.
- A window with no ready runtime shows the same canvas with every
  runtime-specific control absent, a send control that cannot fire, and the
  setup notice beneath the composer. The gate is a notice
  beneath the composer, never a screen in place of it, and it advertises no
  ability a bound runtime has not reported.
- The gate has three states and is decided from the session's own bound
  runtime. `checking` holds the offer back until the catalog answers, because
  treating an unanswered catalog as nothing-ready shows setup to a reader who
  is already set up and then withdraws it.
- CodeMirror owns composer text, selection, undo, and the `@` and `/` handoff.
  A mention is one atomic widget. The chip lives where it was typed, moves with
  the text, and deletes as one character, while the serialized draft reads
  `@path` in its place. An armed skill is a token at the head of the document
  that serializes to nothing, because the server composes the skill into the
  wire prompt.
- The composer's left cluster is who runs the turn and under what rules: the
  runtime, its permission mode, and Instructions. The right edge, beside Send,
  is what it runs on: one model-and-thinking control whose menu opens on the
  level and keeps the model list one layer deeper, behind a row that swaps the
  popup's content without closing it. The runtime and the model-and-thinking
  controls go inert while a turn streams, because the runtime binds them when
  the turn starts. The control renders only when the runtime advertises a
  model or a level choice, and opens straight on the model list when it
  advertises no level. Picking another runtime opens a new chat on the same
  scope rather than rebinding the conversation to a runtime its transcript
  did not come from.
- What the next turn runs on is one derivation, `modelChoice`, shared by the
  control and the session's effort verb: the explicit pick, else the model the
  runtime reported running, else the catalog entry it flags as its default;
  the level is the explicit pick, else that model's declared default. A row
  sends its own id. The untouched state is the omitted override, named by the
  runtime's own declaration and never guessed from catalog order; a runtime
  that declares no default keeps a Default row in each list. A model pick
  closes the menu and a level pick keeps it open, which is the primitive's
  radio default every choice menu here rides. A populated Claude conversation
  keeps its model fixed while its level stays changeable.
- The cluster gives ground as the pane narrows, read from the composer's own
  container: at the narrow step the provider's name, the mode's name, the
  Instructions label, and the model's name go, so the right control reads as
  its level, or as the name while no level is known; at the narrowest the
  level goes too, and every trigger's title still names its selection.
- A fresh chat names what it will run on before any session exists. The
  runtime listing carries the catalog the service remembers for each runtime
  (`Agent.models`, with the last-observed default marked when the catalog
  flags none), and the workspace hands it to the session through
  `seedModels`, which the session refuses once its connection has left the
  draft state, because from then on the socket's own catalog event owns the
  list. Opening the control still requests the live catalog, and a runtime
  nothing has ever read reads Default until it is.
- Permission mode is its own control in the left cluster, so the state reads
  without opening a menu. The four modes are product promises, not runtime
  settings: `domain/access.ts` owns their order and the settling rule, the
  menu offers only the promises the runtime's catalog entry lists in `modes`,
  and the workspace settles a session off a promise its runtime cannot keep
  through `honoredAccessMode` (Auto first, then Ask) before the next turn
  binds it. The control renders only when the runtime lists at least one
  mode. Each row describes the promise and never one runtime's behavior, and
  Plan's glyph is not the Instructions scroll.
- Bound context is explicit. A mention, a dropped source, and an upload are the
  three ways a file enters a prompt; the open document is never implicit
  context. Uploads are offered only when the runtime advertises that it can
  read transient bytes, while a source dragged from the tree stays available
  either way because it is a path the Agent reads back through MCP.
- A clipboard image pasted with the composer focused is taken as an attachment
  and the competing library-import offer is suppressed, so one paste has one
  meaning.
- Every bound item is validated against the folder snapshot the shell publishes
  before a send. A stale item refuses the send and says why; preparing, failed,
  and blocked items are explained and sent. That snapshot is the only thing a
  mention can reach, and derived folders never enter it.
- Text, a bound item, or an armed skill each make a draft sendable. One
  predicate decides both the send control's enablement and the submit path, so
  the control can never offer a send the composer refuses.
- A prompt written while a turn runs joins the renderer queue. Pulling a queued
  message back into the composer restores the context it was queued with, and
  the prompt ledger keeps one snapshot per queued id so one dispatch consumes
  one snapshot.
- An empty conversation shows one greeting and a composer whose placeholder
  cycles through the three requests `emptyChatPrompts` derives for the scoped
  folder, at the ambient label cadence, paused while the composer is focused
  and static under reduced motion. The composer passes `placeholderIsPrompt`
  down only while one of those is showing, and the editor's Tab keymap then
  fills the empty field with it; it never sends, so the visible request stays
  the reader's to edit before it becomes the one the Agent gets. A placeholder
  change crossfades in the editor at the ambient crossfade pace from
  `lib/springs.ts`, slower than any interaction step. The user's visible
  request is
  exactly what the Agent receives, and no surface carries a second hidden
  prompt.

## Agent Instructions

- Each scope has standing instructions every Chat in it starts with: a packaged
  default the reader may replace, addressed by the scope's own key over one
  read and one write route. The Agent feature owns that Port and its Adapter,
  and `renderer/src/app/dependencies.ts` binds it beside the catalog, context,
  and session Ports.
- The editor is reached from the composer. Its control names the scope, and a
  quiet dot is the whole presence indicator. It says the reader has replaced
  the packaged default here, which is the one fact a glance needs.
- The draft is local until saved and is abandoned when the active scope
  changes, because it belonged to the scope the reader left and carrying it
  forward would offer to save it into the new one. Saving empty removes the
  customization and reloads the packaged default, which is the only way back
  once a scope is customized.
- The field is monospace and carries no caveats, because the runtime carries
  these bytes verbatim and a line break there is content. Copy says a save
  applies from the next conversation and never claims to edit `AGENTS.md` or
  `CLAUDE.md`.
- The resolved prompt is never spoken in the renderer. The server composes
  what a turn actually carries, and that composition belongs to
  [Agent Runtime](agent-runtime.md#session-scope-and-lifetime).

Wiki Pages,
[J12](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder),
are not a staged machine of their own. Building a wiki is an ordinary visible
request against the active folder, sent through the same composer, answered
through the same permission surface, and applied through the same server-side
write path as any other request. Its one entry point is the composer's
cycling **Build a wiki for docs** request, and its durable half is the
folder's Agent Instructions.

## Transcript and Turn Lifecycle

- Streaming follows the end of the log only while the reader is within a
  threshold of it, so scrolling up to read is never undone. Switching
  conversations re-pins and jumps to the end.
- Blocks arrive already shaped by the session domain, so the transcript decides
  presentation only: day breaks between prompts, consecutive tool calls
  collapsed into one expandable group, and a bounded page of the newest blocks
  with an explicit control for earlier ones.
- The one in-flight turn is `aria-busy` until it settles, so token streaming
  does not re-announce the live tail. Each turn states its speaker for
  linearized reading; bubble alignment alone is not attribution.
- Every prompt, and every settled reply that closes a turn, carries one
  hover-revealed meta row of icon-only actions beside its time. Copy is on
  both and carries the untouched source text; edit is on the latest prompt
  only, and only while no turn is active. The row is never behind a menu, is
  reachable by keyboard focus, and stays visible where hover does not exist.
  The one icon geometry is owned by the message primitive, and the row
  overhangs the message's outer edge by the glyph's inset so a reply's copy
  glyph sits on the same left line as the reply text and the tool groups.
- Edit takes the prompt back as the draft: the text as typed, the bound
  context, and the skill it ran under, from the prompt ledger when the send
  was live and from the transcript's own text otherwise. The sent prompt
  stays in the transcript and the edited text goes out as a new turn on the
  same native session; nothing is forked or truncated.
- A hover message time renders only when a real clock recorded one: a
  prompt's is its send, a reply's is when its turn settled, and the reply
  shows the turn's duration only when both ends were recorded. Restored
  history invents no duration and no timestamp.
- A tool row is compact and inspectable, and one payload ladder serves both the
  row and the permission card so the two cannot drift: the diff when the call
  is a file change with evidence, bounded inert text otherwise. An intermediate
  failure may tint its row without turning the group into a terminal error.
- Permission requests are cards with the decision on them and never enter a
  collapsed group. A reply is refused unless the named tool is still awaiting
  that exact permission id, so a stale answer cannot approve a different call.
  The card leaves the transcript on decision, so focus follows the decided tool
  into the activity group that now holds it.
- A turn failure appends one recovery card whose retry resends exactly what
  went out for that turn, taken from the prompt ledger rather than from the
  transcript's newest text. A skill-only turn goes out with empty text, so the
  presence of a recorded prompt, not its emptiness, decides whether the failed
  turn can be resent. Acting on the card settles it. A turn failure never gates
  the panel and never ends the session.
- A non-fatal notice is a quiet transcript line. It does not settle a turn,
  refresh runtime failure state, or close the session.
- Scope retirement is not a fatal transport state. Running and
  permission-waiting tools become cancelled history, settled content is
  unchanged, and no reconnect is offered. A raw socket close still climbs the
  reconnect ladder, which spends three bounded jittered attempts before the
  conversation reports one interrupted failure with a manual reconnect.
- Files a settled write changed are reported against the scope the work was
  observed under, so a folder switch cannot re-attribute a completed write. The
  window refreshes the listing and preparation state for exactly those paths
  and selects nothing; opening a changed file stays the reader's explicit act.

## Rendering and Accessibility

- Agent response Markdown renders as React elements with GFM behavior. Raw HTML
  is inert, an in-page anchor stays in place, an `http` or `https` link opens
  through the external-navigation seam, and any other scheme renders as text.
- The `@` and `/` suggestion panel is a listbox the editor keeps focus over.
  Arrow keys, Enter, Tab, and Escape are one declared binding shared by the
  editor that raises them and the panel that answers them, and the active row
  is named through `aria-activedescendant`.
- The chats list is a sidebar tree of recency groups. A row opens on a click,
  renames in place on a slow second click or F2 (the Chat pane's header
  renames the open conversation the same way), and deletion is a confirming
  dialog that stays open on a refusal so the reason stays in front of the
  reader who asked for it.
- Managed primitives own focus trapping, Escape, outside press, collision, and
  announcements. Do not add document-level dismissal handlers.
- Attachment paths are machine context, not visible prose. A transient upload
  previews only from the File this session still holds; a restored history path
  never becomes a readable URL.
- Active thinking or tool work has one liveness cue at a time and becomes
  static under reduced motion.

## Gallery

The Agent Panel's stake in the shop is a seam, not ownership. The shop is its
own feature, `renderer/src/features/gallery/`, over the daemon's pinned-host
index and image proxy in `server/routes/gallery.ts`. It is reached two ways and
both are composed in `renderer/src/app/`. A bare window derives a band on its
welcome screen, and a folder window offers a sidebar row. Copying an entry runs
the ordinary public-GitHub import into folder home and opens the copy in its own
window through the `openFolderWindow` Electron channel, while the shop stays
put.

Because the Gallery is a sibling feature, no Agent module may import it, and
`renderer/src/app/composition/gallery/use-gallery-shop.tsx` is the only seam.
What binds the shop to this contract is the outcome rather than the mechanism.
[J13](../design-docs/user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery)
hands the reader a ready-made wiki that
[J12](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder)
would otherwise build. The shop's index contract, snapshot fallback, and copy
latch belong with its own feature and are not restated here.

## Known Gaps

Required behavior is stricter than Current behavior in each of these. Every
gap below is observed in Shipping.

- **Classified turn failures render one card.** The Adapters classify a turn
  failure into a structured kind and the renderer carries that kind in
  transcript state, but no surface reads it. Every classified failure gets the
  same card and the same resend, so rate, network, and quota recovery is
  correct while an expired sign-in or an exhausted included allowance offers a
  retry that cannot succeed until the reader recovers elsewhere. The kinds and
  the recovery each one is owed are in
  [Agent Runtime](agent-runtime.md#protocol-boundary).
- **Replies render no math.** Agent Markdown runs GFM only. TeX delimiters stay
  literal, so a reply carrying a formula shows its source.
- **A saved instruction edit does not reach a mounted conversation.** The
  Adapters inject the resolved text when a native session mounts, so a save
  reaches Chats started after it and the dialog says exactly that. A mounted
  conversation keeps the text it started under until it reconnects; nothing
  remounts it on a save.
- **Retrieval policy is not per conversation.** The protocol carries the
  policy event and every Adapter implements it, but no renderer surface sends
  it, so every Chat runs on the Adapter default and searches by meaning.
- **A migrated Library conversation does not move the window.** A validated
  scope change rebinds the conversation's scope only. The window does not enter
  the new member folder and the conversation is not selected there, so a reader
  finishing
  [J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project)
  reaches the new project through the folder switcher.
- **There is no jump-to-latest control.** The log pins and unpins from the
  reader's own scroll position.
- **A restored prompt's attachments do not follow an edit.** The renderer
  never held their bytes, so edit on a prompt replayed from native history
  returns its text alone; a live send's uploads come back as tiles.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Feature boundary | `renderer/src/features/agent/public.ts` re-exports the Ports and their Adapter factories, the two lazy surfaces, the titlebar's chat-navigation and new-chat buttons, the window runtime hook, the instructions editor hook, and the composer-focus marker. Only modules under `renderer/src/app/` may read it |
| Window runtime Interface | `renderer/src/features/agent/application/workspace-runtime.ts` owns tabs, mounting, the window-folder rule, retirement, and the history verbs; `renderer/src/features/agent/hooks/use-agent-workspace-runtime.ts` is its React lifetime |
| Conversation Interface | `renderer/src/features/agent/application/session/runtime-contract.ts` declares the verbs a composer and a transcript call; `renderer/src/features/agent/application/session-runtime.ts` assembles them over the transport, dispatch, event, prompt-ledger, and files-changed Modules in `renderer/src/features/agent/application/session/` |
| State Modules | `renderer/src/features/agent/domain/session.ts` is the one reducer and the selectors that read it, over the shapes in `session-state.ts` and the transcript edits in `session-transcript.ts`; tabs are `renderer/src/features/agent/domain/workspace.ts`; the runtime registry, capability resolution, and readiness gate are `renderer/src/features/agent/domain/agent-catalog.ts`; `model-choice.ts` beside them derives what the next turn runs on |
| Bound context Module | `renderer/src/features/agent/domain/context.ts` owns mention ranking and text editing, validation against the published folder snapshot, wire-prompt rendering, and transcript segmentation |
| Empty-chat prompts | `renderer/src/features/agent/domain/starters.ts` owns the three requests, `renderer/src/features/agent/hooks/use-rotating-prompt.ts` cycles them, the Tab-accept lives in the editor's keymap in `renderer/src/features/agent/ui/composer/mention-editor.tsx`, and `placeholder-crossfade.ts` beside it owns the swap's timing |
| Ports | `renderer/src/features/agent/application/ports.ts` |
| Adapters | `renderer/src/features/agent/infrastructure/session-api.ts` for the socket and history HTTP, plus `catalog-api.ts`, `context-api.ts`, and `agent-instructions-api.ts` beside it |
| Wire schemas | `shared/protocols/websocket/agent-session.ts` with `shared/protocols/http/agent-sessions.ts`, `shared/protocols/http/agent-runtime.ts`, `shared/protocols/http/agent-context.ts`, and `shared/protocols/http/agent-instructions.ts` |
| Conversation surface | `renderer/src/features/agent/ui/workspace.tsx`, behind `renderer/src/features/agent/ui/workspace-lazy.tsx`, places the transcript, the connection strip, the composer, the starters, and the setup notice in `renderer/src/features/agent/ui/setup.tsx` |
| Transcript Modules | `renderer/src/features/agent/ui/transcript/transcript.tsx` owns the block list and turn layout; `activity.tsx` owns tool groups and permission cards over `tool-presentation.ts`; `file-change.tsx` owns diffs; `markdown.tsx` is the reply renderer |
| Composer Modules | `renderer/src/features/agent/ui/composer/context-composer.tsx` owns the card, the drops, the pastes, and the send predicate; `mention-editor.tsx` with `mention-document.ts`, `mention-markers.ts`, and `mention-widgets.ts` owns the text field; `context-rows.tsx` and `mention-listbox.tsx` own the suggestion panel; `context-tiles.tsx` owns bound tiles and chips; `provider.tsx`, `permission-mode.tsx`, and `thinking.tsx` own the control cluster over the breakpoints in `narrow.ts` |
| Agent Instructions | `renderer/src/features/agent/hooks/use-agent-instructions.ts` owns the per-scope read, the local draft, and the save; `renderer/src/features/agent/ui/instructions/agent-instructions-control.tsx` and `agent-instructions-dialog.tsx` own the surface |
| Chats list | `renderer/src/features/agent/ui/chats/chats.tsx` behind the same lazy boundary, over `conversation-tree.tsx`, `delete-conversation-dialog.tsx`, and the grouping in `renderer/src/features/agent/domain/conversation-history.ts` |
| Composition | `renderer/src/app/composition/layout/workspace-panes.tsx` binds the conversation surface, `workspace-sidebar.tsx` places the chats list and the Gallery row, `agent-document-workspace.tsx` owns the split, and `workspace-layout.tsx` stamps the feature's own surface marker so the paste rule needs no Agent selector in the shell. `renderer/src/app/composition/folder/use-agent-environment.ts` publishes the folder snapshot the Agent validates against, and `renderer/src/app/composition/folder/use-folder-refresh.ts` consumes the settled-write report |
| Attachment HTTP Adapter | `renderer/src/features/agent/infrastructure/context-api.ts` and `server/routes/attach.ts` |
| Gallery seam | `renderer/src/features/gallery/` composed at `renderer/src/app/composition/gallery/use-gallery-shop.tsx`, with `server/routes/gallery.ts` as its daemon proxy |
| Focused evidence | the colocated tests under `renderer/src/features/agent/`, plus `renderer/src/app/composition/layout/agent-convergence.test.tsx`, `renderer/src/app/composition/folder/use-agent-environment.test.tsx`, and `renderer/src/app/composition/gallery/gallery-shop.test.tsx` |

## Validation

Run:

```bash
pnpm typecheck
pnpm lint:web
pnpm test:renderer
pnpm test:protocols
pnpm test:library-files
pnpm build:web
```

`pnpm test:renderer` covers the feature's colocated tests and the composition
tests beside them. `pnpm test:protocols` covers the Agent wire schemas.
`pnpm test:library-files` covers the attach route and the daemon's gallery
proxy guard. Journey automation and pixel baselines retired with the Playwright
suites, so prove an affected Agent journey with focused renderer tests, story
accessibility, and a driven runtime pass through the built application. Exact
protocol fixture sequences belong in tests. Real credentials, packaged
discovery, and the clipboard and native Seams remain release sanity checks.

Related journeys: [J01](../design-docs/user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat),
[J07](../design-docs/user-journeys.md#j07-converge-chat-into-a-document), and
the [J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
core loop. Wiki Pages are
[J12](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder),
the Gallery seam carries
[J13](../design-docs/user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery),
and the Library-to-project session transition is
[J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project).

Related contracts: [Agent Runtime](agent-runtime.md),
[MCP Access](mcp-access.md), [Renderer Workspace](renderer-workspace.md), and
[Renderer Styling](renderer-styling.md).

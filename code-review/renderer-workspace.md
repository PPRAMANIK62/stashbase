# Renderer Workspace

> Review contract for one window's active-folder workspace, document tabs,
> retrieval presentation, shell overlays, and renderer liveness.

## Scope and Ownership

A window is one folder scope, the documents open on it, and the panels that
read them. The Workspace feature owns library membership presentation, the
Files tree, folder mutations, and the folder's own transitions behind
`renderer/src/features/workspace/public.ts`. Nothing outside that barrel
reaches into the feature.

Cross-feature ordering belongs to app composition rather than to any feature.
The window's chrome, its notice strip, its command surfaces, and the two named
document workflows live under `renderer/src/app/composition/` and
`renderer/src/app/workflows/`. `renderer/src/app/shell.tsx` decides only what
each composed part is handed, and `renderer/src/app/dependencies.ts` is the one
file that selects Adapters and binds Ports.

The layer model, the state-ownership rules, and every gate that enforces them
belong to [Renderer Architecture](renderer-architecture.md). What matters here
is one consequence of it. The Workspace feature answers for its own transports
through a single Adapter record (`createWorkspaceAdapters` in
`renderer/src/features/workspace/infrastructure/adapters.ts`), so moving one of
its Ports between HTTP and the desktop bridge is not an app change.

Renderer state is presentation state. The server owns membership, source bytes,
source versions, preparation completion, and semantic readiness. The window's
own arrangement is persisted as a session snapshot, and that snapshot is
untrusted input on the way back in.

## Workspace Invariants

- Every asynchronous completion passes through a Runtime's `capture()` and
  `accept()` pair. `capture()` is taken before the operation's first `await`
  and handed back afterwards; `accept()` runs the completion only while the
  captured scope is still live, no newer retirement has intervened, and the
  runtime is not disposed. One shared implementation
  (`createScopeGuard` in `renderer/src/shared/runtime/scope-guard.ts`) backs
  the workspace, document, tabs, and Agent runtimes, so an ad-hoc generation
  counter beside a runtime is a defect. The generation travels beside the scope
  rather than inside it, because the scope alone cannot tell a completion apart
  from one the same scope retired while it was in flight.
- A workspace runtime exists per folder and per generation and never outlives
  either. `useScopedRuntime` in
  `renderer/src/shared/runtime/use-scoped-runtime.ts` refuses to hand back a
  runtime built for a key that has since changed, so a render between a folder
  change and the new runtime's commit sees no runtime rather than the previous
  folder's. Rebinding a folder in place calls `retireOperations()` instead of
  disposing, because the folder stays open while the work aimed at its previous
  tree does not.
- Asynchronous work that does not settle into a store takes a named lane from
  `useRequestSignals` in
  `renderer/src/shared/runtime/use-request-signals.ts`. Repeating a command on
  the same lane aborts the call already in flight, lanes are independent, and
  unmounting aborts all of them. Folder changes share one lane, so asking for a
  second folder abandons the first and the abandoned request is exactly the one
  whose signal is aborted.
- The workspace session is explicit. `WorkspaceSessionSnapshot` in
  `renderer/src/features/workspace/domain/session.ts` is one versioned,
  concept-specific shape carrying the active folder, per-folder expansion,
  selection and tab identities, and the two remembered pane widths. It is not
  whole-store persistence middleware, and no store is serialized wholesale.
  Every bound in that module is a restore-time guard. A snapshot read back from
  disk is truncated and clamped rather than believed, and the wire schema in
  `shared/protocols/electron/workspace-session.ts` refuses a version, a shape,
  or a byte size it does not own.
- Nothing is restored before the saved session has loaded. A folder may only be
  opened once the session controller reports `ready`, which is also the only
  state that carries a folder to restore. Saves are queued and drained one at a
  time, and a failed save is swallowed rather than allowed to make the
  workspace unusable.
- Which folder a window lands on is one ordered rule, not a chain of
  conditions. `chooseFolderLanding` in
  `renderer/src/features/workspace/domain/landing.ts` reads the server's folder
  for this window, then the folder the desktop created the window for, then the
  saved session's folder when it is still a member, then nothing. The
  desktop's claim is a distinct pending state between the first two, so the
  race is settled by the ordering rather than by a guard beside it, and the
  welcome screen never flashes while a claim is outstanding. Reading the
  server's folder first is what stops a spent claim pulling a reader back to
  where they started, and it is also what makes a reload correct with no
  further rule.
- Multi-window reconciliation goes through durable owners, never through
  renderer replication. Exactly one window claims the stored snapshot at
  startup (`claimRestore` in `electron/main.cjs` over
  `electron/workspace/session.ts`); every later window starts from defaults, so
  two windows never restore the same folder and tabs. Membership,
  active-folder binding, and the folder's tree revision are read back from the
  server or the host rather than mirrored between windows. A window never
  merges another window's snapshot.
- Telling the host which folder this window is on can itself fail, and a window
  whose host disagrees about its folder can no longer reconcile anything. That
  refusal is reported as a notice rather than swallowed.
- Folder loss and host-reported removal share one reconciliation lane. Starting
  either abandons the other, and every step after an `await` re-asks whether its
  own signal is still the live one before writing. Losing the server is not
  proof of scope loss, so a failed membership read preserves the mounted
  workspace and its own recovery rather than retiring the folder.
- Hidden-entry visibility is one durable application-level preference and the
  server keeps classification authority. `WorkspacePreferencesPort` in
  `renderer/src/features/workspace/application/ports.ts` only asks for eligible
  hidden entries to be listed and can never widen what is eligible. Which
  hidden paths are eligible, which stay protected, and which surface as bounded
  excluded rows is decided in `server/file-listing.ts` behind
  `FolderListingOptions`, and `/api/files` reads the durable preference itself.
- The renderer owns the toggle and the echoed state, nothing more. Every read
  and write answers with the visibility the server actually applied, and the
  menu is drawn from the listing on screen rather than from a value the window
  asked for, so rows and menu cannot disagree. A refused or failed write
  changes nothing. The successful write invalidates the open folder's listing
  directly, because the reader just asked for it; other windows converge on the
  ordinary preparation-status poll, whose idle interval is the upper bound on
  that convergence.
- Public repository import is a folder-explicit request from a Library surface.
  The server owns cloning, isolated staging, atomic publication, registration,
  and the background sync trigger. The renderer owns validation feedback and
  the request lifecycle only. URL and destination-name feedback comes from the
  same repository Contracts the server validates with
  (`shared/github-import.ts` and `shared/folder-name.ts`), so a reader is
  refused inline by the rule that would refuse them anyway; the server parses
  both again, which makes the renderer's copy feedback rather than authority.
  The destination name follows the URL until the reader edits it and stops
  following once they have.
- A refusal names a code the adapter turns into a sentence, so no transport
  prose reaches a reader and a code this build does not know falls back to the
  ladder's own line. A cancelled import leaves no partial member behind. The
  published path is opened through the same folder lane every other folder
  change uses, so the save barrier and abandonment rules apply to it too.
- Retrieval navigates within the selected workspace only. The search surface is
  bound to the active folder's path, each backend sends that folder explicitly,
  and occurrences outside the searched folder are dropped before they reach the
  reader whatever the daemon answered. Quick Open ranks only the open folder's
  listing and refuses an intent whose folder is not the open one. There is no
  Library-wide retrieval scope in this renderer, so no surface has a scope
  selection to inherit or retain.
- Ways to search a folder are a registry, not a branch. `SearchBackend` in
  `renderer/src/features/retrieval/ui/search/backend.ts` carries a backend's
  request, rows, copy, and readiness gate, and
  `renderer/src/features/retrieval/ui/search/backends.ts` is the whole list in
  tab order. A backend that search by meaning gates declares an index gate; the
  absence of one is the statement that the backend answers from the folder
  itself and is never held back.
- One source identity owns at most one document tab in a window. Tab
  transitions are queued and each re-reads the open set after the save it
  awaited, so an asynchronous caller's earlier duplicate check is never the
  uniqueness authority. Closing a tab disposes its document runtime, so an
  in-flight load or save for a retired document can never land.
- Document navigation, tab closure, folder change, and native context release
  all cross the same save barrier. A failed save blocks the transition and keeps
  the recoverable buffer mounted. Retiring the documents under an entry about to
  be renamed or deleted saves and closes each one and re-checks the captured
  folder scope after every close; what is still open then is no longer this
  folder's to settle, and the entry must stay where it is.
- Window-level chords that cross features are owned by app composition. One
  hook per chord under `renderer/src/app/composition/commands/` declares its
  matcher and its action over the single listener in
  `renderer/src/app/composition/commands/use-window-command.ts`. A feature does
  not register a chord that belongs to the window.
- Two exceptions are deliberate and bounded. The Documents feature owns the
  chords whose verbs are its own in
  `renderer/src/features/documents/hooks/use-document-commands.ts`, and every
  one of them asks its runtime to act and reads back whether it did rather than
  inspecting document state. The sidebar collapse chord belongs to the
  installed sidebar primitive. A third such owner needs a reason in review.
- In-app menus are typed targets rather than conditionals. A tree menu is built
  from one target union in
  `renderer/src/features/workspace/ui/file-tree-menu.tsx`, a row that carries
  state announces itself as a checkbox, and a restricted entry offers reveal
  and nothing else. The tree's own space, down to the sidebar footer, re-enters
  a right click into the section's menu as long as Files is showing and no
  other owner claims the spot.
- Sidebar panels are a registry too.
  `renderer/src/app/composition/layout/sidebar-panels.tsx` is the whole
  definition of the navigator, in tab order, and nothing downstream counts tabs
  or compares indices. A panel declares whether it replaces the scrolling tree
  region, and a panel expensive to mount stays unmounted until it is selected.
  The document outline is one of those panels and carries no geometry of its
  own. It shares the sidebar's width and the tree's scrolling region, so the
  only resizable seams in the window are the sidebar rail and the Agent seam.
- Both workspace panes are always mounted. The Agent keeps its transcript,
  composer draft, and focus while a document is opened and closed beside it, so
  the split is a width rather than a route. The document pane keeps a floor and
  the Agent pane yields, which is what makes a narrow window collapse the chat
  instead of crushing the page being read.
- Pane geometry is durable, held in the session snapshot and clamped by the
  same bounds in both directions. The Agent seam is a named ARIA separator with
  arrow-key steps and a double-click reset, and every path reports a width
  clamped to the record the domain clamps with. A handle with its own
  arithmetic would drift from the snapshot.
- A drag is never the only way to do something. Dragging a tree row or a
  document tab carries one source identity and nothing else, and the receiver
  decides what the Agent may read; the same source reaches the composer through
  its keyboard mention path, which [Agent Panel](agent-panel.md) contracts.
  **Known Gap.** The sidebar rail is the exception. It resizes by pointer only
  and is not in the tab order, so collapsing has a chord and a titlebar control
  while resizing has no keyboard equivalent.
- Tree row order, visibility, and keyboard order all come from one model.
  Collapsed descendants create no DOM, and the whole keyboard contract is a
  pure function over the rendered rows
  (`renderer/src/features/workspace/ui/file-tree-keyboard.ts`), so it can be
  read and tested without a DOM. Excluded and unreadable folder placeholders
  are non-expandable but stay actionable through the system file manager;
  reduced in-app capability must not be styled or exposed as a disabled object.
- A generic file's format is one renderer capability signal. The tree and Quick
  Open mute it and say that Search and automatic Chat context exclude it.
  Restricted entries expose reveal-only actions, and a reduced-capability row
  states it in one vocabulary. Marking the state on one kind of row while
  leaving another kind visually identical to a fully working entry is a defect.
- A settled mutation hands focus to the row it produced, and only once the
  refreshed listing actually shows that row. Expansion and selection move with
  a renamed entry and are dropped under one that left the tree, so a renamed
  folder stays open and its selected descendant stays selected.
- Tabs, trees, overlays, and dialogs expose semantic selection and focus state.
  Destructive confirmation identifies the complete subject. Library removal
  names the home-shortened member path, and entry deletion names the
  folder-relative path, both in a copyable monospace block beside the sentence.
- The strip above the workspace carries only things the reader did not ask
  about directly. A refusal of their own request is said as an alert, a
  capability StashBase could not reach as a quiet status, and an optional offer
  as an offer with the thing to take up beside the dismissal. Order is by
  urgency, so a refusal of something the reader did try precedes an offer of
  something they have not asked for.
- The open folder's cached views are re-read through one composer
  (`renderer/src/app/composition/folder/refresh-folder.ts`). Each feature owns
  the invalidation of its own keys and a caller names what changed rather than a
  query key. Two things disagree with the cache. The daemon publishes a tree
  revision with every status poll, and a revision that moves means something
  outside the app touched the folder, but only after a revision has been seen
  for this folder, otherwise every folder switch would refetch a listing it just
  fetched. The Agent reports exactly which files its settled write changed, and
  nothing selects a file on the reader's behalf.
- Preparation calls the shell makes on the reader's behalf take one lane per
  call and per subject, and a refusal becomes one sentence the strip can show.
  A second reprocess of the same file replaces the first while reprocessing a
  different file leaves it running.
- Polling, timers, controllers, and native subscriptions retire when their
  generation or window context ends. The folder's status poll is nested under
  the folder's own query key, so retiring a folder cancels and drops the poll
  with the listing. Late results cannot repopulate reset state.
- The window declares when its first paint is trustworthy. `data-boot-settled`
  is set exactly once the library has answered and no folder restore is still
  in flight, which is what the desktop harness waits on. The Agent latch is
  separate and one-way, so emptying the library does not tear down a running
  conversation.
- The blank-chat lifecycle follows [Agent Panel](agent-panel.md). The workspace
  may reveal or dock the Agent but does not redefine Agent session scope.

## Failure Containment

[Renderer Architecture](renderer-architecture.md) states the rule this window
is held to. How far it actually reaches is below.

There is one boundary implementation and three placements.
`renderer/src/shared/runtime/surface-boundary.tsx` draws the recovery and owns
none of its words: it is a leaf, so it cannot reach a feature's
failure-message module, and a caught render error's own message is written for
a developer rather than a reader. Every caller supplies its sentence and its
way out.

Startup sits above it. `renderer/src/app/bootstrap/startup.tsx` catches a
window whose preload bridge is missing and renders
`renderer/src/app/bootstrap/startup-failure.tsx` instead of a shell that would
fail on its first call. The shell is the second placement:
`renderer/src/app/shell-boundary.tsx` wraps the whole composition, so a render
failure anywhere inside it remounts that subtree and offers to reopen the
workspace rather than leaving an empty window. Deferred surfaces are the third.
`lazySurface` in `renderer/src/shared/runtime/lazy-surface.tsx` names the three
decisions every code-split surface makes, and the Agent workspace and Quick
Open each pass it a boundary with their own recovery.

The shell recovery's wording is deliberately narrow, because the guarantee is.
Journaled snapshots survive the remount, since the server sealed them to disk
outside React. The dirty buffer does not, because the tabs runtime is disposed
with the subtree. Snapshots also trail the typist by design, so the newest text
was never journaled, and on an installation without operating-system key
protection the journal is off entirely. The sentence therefore promises what
could be stored rather than recovery.

Losing the local server does not reload the renderer. No renderer module calls
the window-lifecycle bridge's reload, cached views and their unsaved buffers
stay mounted, and each refused read offers its own retry. The folder's status
poll re-attempts on its own interval, so a recovered server converges without
the reader doing anything.

**Known Gap.** Settings has no boundary of its own, so a render failure inside
it is caught by the shell boundary and remounts the whole composition rather
than the dialog. There is also no bounded reconnect ladder for HTTP. Every renderer query is
configured with retries off, so recovery from server loss is either the
preparation poll's fixed interval or a reader-initiated retry, not a ladder. The
one bounded reconnect ladder in the renderer belongs to the Agent session
socket and is contracted in [Agent Runtime](agent-runtime.md).

## Deferred Surfaces

The initial renderer carries the window chrome, the sidebar, and the folder's
own surfaces. Settings, Quick Open, the Agent workspace, the Agent chats list,
and every document viewer are dynamic entries behind `lazySurface` or `lazy`,
and Settings and Quick Open do not even import until they are opened. Move a
surface into or out of that set only when the ownership of eager shell behavior
changes. Nothing measures the result. A surface that becomes eagerly imported
by accident is caught by review, not by an assertion, which is one instance of
the performance-budget gap [Renderer Architecture](renderer-architecture.md)
records.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Interface | `renderer/src/features/workspace/public.ts`, with `WorkspaceRuntime` in `renderer/src/features/workspace/application/runtime.ts` as the folder's own transition seam |
| Primary owners | `renderer/src/features/workspace/domain/tree.ts`, `domain/workspace.ts`, `domain/library.ts`, `domain/session.ts`, and the `application/runtime.ts`, `application/session-runtime.ts`, `application/open-folder.ts`, `application/add-folder.ts`, `application/remove-folder.ts`, `application/queries.ts`, `application/failure-messages.ts` Modules over the Ports in `application/ports.ts` |
| Feature hooks | `renderer/src/features/workspace/hooks/use-workspace.ts`, `use-workspace-session.ts`, `use-library.ts`, `use-library-lifecycle.ts`, `use-files.ts`, `use-tree.ts`, `use-hidden-files.ts`, `use-folders.ts`, `use-file-operations.ts`, `use-github-import.ts`, `use-remove-folder.ts`, `use-reveal.ts` |
| Feature views | `renderer/src/features/workspace/ui/sidebar.tsx`, `ui/welcome.tsx`, `ui/file-tree.tsx` with its `file-tree-model.ts`, `file-tree-keyboard.ts`, `file-tree-focus.ts`, `file-tree-rows.tsx`, `file-tree-menu.tsx`, `file-tree-naming.tsx`, `file-tree-space-menu.ts` concerns, `ui/import-github-dialog.tsx`, `ui/remove-folder-dialog.tsx`, `ui/delete-entry-dialog.tsx`, `ui/clipboard-offer.tsx` |
| Document tabs and barrier | `renderer/src/features/documents/application/tabs-runtime.ts`, `application/document-runtime.ts`, `hooks/use-document-tabs.ts`, `hooks/use-document-commands.ts`, `hooks/use-document-save-barrier.ts` |
| Retrieval surfaces | `renderer/src/features/retrieval/ui/library-search.tsx`, `ui/search/surface.tsx`, `ui/search/backend.ts`, `ui/search/backends.ts`, `ui/quick-open.tsx`, `ui/managed-quick-open.tsx`, `ui/readiness-notices.tsx` |
| Composition root | `renderer/src/app/shell.tsx`, `renderer/src/app/providers.tsx`, `renderer/src/app/dependencies.ts`, `renderer/src/app/composition/dependency-context.tsx` |
| Window chrome and layout | `renderer/src/app/composition/commands/use-workspace-commands.ts`, `use-window-command.ts`, `use-quick-open-command.ts`, `use-sidebar-search-command.ts`, `use-preparation-commands.ts`, `use-capture-focus.ts`, and `renderer/src/app/composition/layout/workspace-layout.tsx`, `workspace-sidebar.tsx`, `sidebar-navigator.tsx`, `sidebar-panels.tsx`, `workspace-panes.tsx`, `agent-document-workspace.tsx`, `workspace-titlebar.tsx`, `workspace-notices.tsx`, `workspace-dialogs.tsx`, `workspace-quick-open.tsx` |
| Folder-scoped binders | `renderer/src/app/composition/folder/use-document-workspace.ts`, `use-document-sources.ts`, `use-folder-readiness.ts`, `use-folder-refresh.ts`, `use-workspace-notices.ts`, `use-recovery-drafts.ts`, `refresh-folder.ts` |
| Named workflows | `renderer/src/app/workflows/open-document.ts` and `renderer/src/app/workflows/retire-documents.ts` |
| Scope and liveness mechanics | `renderer/src/shared/runtime/scope-guard.ts`, `use-scoped-runtime.ts`, `use-retained-runtime.ts`, `use-request-signals.ts`, `use-command-surface.ts`, `lazy-surface.tsx`, and `renderer/src/app/bootstrap/startup.tsx`, `startup-failure.tsx`, `use-boot-progress.ts` |
| Server transport Adapter | `renderer/src/features/workspace/infrastructure/api.ts`, `files-api.ts`, `workspace-preferences-api.ts`, `github-import-api.ts`, `upload-api.ts` over `renderer/src/platform/http/client.ts` and `renderer/src/platform/http/classify.ts`, against `server/routes/files.ts`, `server/routes/workspace-preferences.ts`, and `server/file-listing.ts` |
| Desktop lifecycle Adapter | `renderer/src/features/workspace/infrastructure/library-lifecycle.ts`, `capture-api.ts`, and `renderer/src/features/documents/infrastructure/window-lifecycle.ts` over `renderer/src/platform/electron/bridge.ts`, `library-lifecycle.ts`, `window-lifecycle.ts`, `folder-picker.ts`, `capture.ts`, `file-manager.ts` |
| Session store | `renderer/src/features/workspace/infrastructure/session-persistence.ts` over `shared/protocols/electron/workspace-session.ts`, persisted by `electron/workspace/session.ts` and claimed for exactly one window in `electron/main.cjs` |
| Focused evidence | `renderer/src/features/workspace/application/runtime.test.ts`, `session-runtime.test.ts`, `open-folder.test.ts`, `remove-folder.test.ts`, `queries.test.ts`, `renderer/src/features/workspace/domain/session.test.ts`, `domain/tree.test.ts`, `domain/workspace.test.ts`, `renderer/src/features/workspace/hooks/use-workspace-session.test.ts`, `use-library-lifecycle.test.ts`, `use-hidden-files.test.ts`, `use-github-import.test.ts`, `use-file-operations.test.tsx`, `use-tree.test.ts`, `renderer/src/features/workspace/ui/file-tree.test.tsx`, `file-tree-keyboard.test.ts`, `file-tree-menu.test.tsx`, `sidebar.test.tsx`, `welcome.test.tsx`, `renderer/src/features/documents/application/tabs-runtime.test.ts`, `renderer/src/features/retrieval/ui/search/surface.test.tsx`, `ui/search/exact-backend.test.tsx`, `renderer/src/app/composition/layout/workspace-layout.test.tsx`, `workspace-sidebar.test.tsx`, `workspace-quick-open.test.tsx`, `agent-document-workspace.test.tsx`, `renderer/src/app/composition/commands/use-workspace-commands.test.tsx`, `use-quick-open-command.test.tsx`, `renderer/src/app/workflows/open-document.test.ts`, `retire-documents.test.ts`, `renderer/src/app/bootstrap/startup.test.tsx`, `use-boot-progress.test.tsx`, `server/routes/workspace-preferences.test.ts`, `server/__tests__/github-import.test.ts`, `server/routes/files.test.ts`, and `electron/workspace/session.test.cjs` |

Only part of the Feature hooks row is public. `use-workspace.ts`,
`use-workspace-session.ts`, `use-library.ts`, `use-library-lifecycle.ts`,
`use-files.ts`, `use-hidden-files.ts`, and `use-reveal.ts` are re-exported and
are what the app composes with. The rest are private Seams inside the feature,
reached only by its own views. Exporting one of those would create a second
transition Interface beside the runtime, which is the shape this layering
exists to prevent. A sibling feature reaches none of them.

## Validation

Run:

```bash
pnpm typecheck
pnpm test:renderer
pnpm build:web
```

Add `pnpm check:web` when a change moves a module, changes what a layer
imports, or moves ownership between a feature and composition; the gate set
behind it is defined in
[Renderer Architecture](renderer-architecture.md). Add `pnpm test:protocols`
when a wire schema changes.

Journey automation retired with the Playwright suites. Prove launch,
navigation, and save behavior through the Electron boundary suites and
`pnpm test:electron:smoke`, and prove affected folder, tab, search, focus, or
layout journeys with focused renderer tests and a driven runtime pass. Reserve
manual review for representative composition changes.

Related journeys: [J01](../design-docs/user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J02](../design-docs/user-journeys.md#j02-add-and-open-a-folder), and
[J03](../design-docs/user-journeys.md#j03-read-and-edit-source-documents), plus
[J05](../design-docs/user-journeys.md#j05-search-and-open-source-evidence) for
search presentation and result navigation, and
[J10](../design-docs/user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
for the complete cross-surface loop, and
[J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project)
for project registration and originating-window entry, and
[J12](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder)
for pending folder-pinned activation.
Related contracts: [Renderer Architecture](renderer-architecture.md),
[Window Lifecycle](window-lifecycle.md),
[File Transactions](file-transactions.md),
[Settings and Config](settings-config.md), and
[Agent Panel](agent-panel.md).

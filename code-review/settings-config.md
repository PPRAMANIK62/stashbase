# Settings and Config

> Review contract for durable application preferences, credentials, Settings
> UI, migration, and runtime reconfiguration.

## Ownership and Interface

`server/app-config.ts` is the single persistent app-config Module and the Node
server is its only writer. Domain routes expose narrow Interfaces for
appearance, capture, workspace visibility, onboarding, updates, embedding,
transcription, Agent runtimes, and MCP transport settings. Renderer panels are
Adapters over those routes; they do not own durable truth.

The renderer reaches every one of those routes through
`renderer/src/features/settings/` and nothing else. `application/ports.ts` and
`application/embedder-port.ts` declare the Ports, `infrastructure/` implements
them over HTTP, one hook per capability owns that capability's reads, writes,
and ordering, and a panel under `ui/` renders what its hook returns and holds
only which dialog is open. `renderer/src/app/dependencies.ts` binds the Ports
once at startup, so a panel is never handed a transport it merely passes on.

The workspace hidden-files preference is application-level: reads fail safe
to the default-off view so an unreadable config never blocks listings, the
write path stays strict, and the toggle route bumps the shared tree version
so every window's listing converges on the same durable value. The route
answers every read and write with the state it actually applied, so a window
can never show rows one way and its menu the other. Renderer presentation of
that toggle is contracted in [Renderer Workspace](renderer-workspace.md).

Ambient capture is fail-closed: app config owns the opt-in, while Electron main
only executes the current clipboard-monitoring state.
Automatic desktop update checks are default-on: app config owns the preference,
while Electron main reads it through the local route and owns the release
runtime.

Models, derived data, caches, the pinned OpenCode state, and legacy managed
Agent runtimes live under AppData and are not app-config fields. Claude Code
and Codex configuration files are rewritten only by Agent readiness
(`ensureAgentMcp`). Wiki Agent receives an in-memory OpenCode config and
per-session MCP environment instead of a durable client config. StashBase never
writes any other client's configuration, so the MCP Settings page is a
read-only access surface external clients copy from.

## Credential Boundary

- BYOK credentials are accepted and persisted only through Settings.
  Environment variables may isolate automated tests or select runtime plumbing,
  but are never the product credential source of truth.
- Every credential a Settings section touches arrives through a Settings-owned
  Port and no other route. Embedding and the hosted account go through
  `EmbedderPort` in
  `renderer/src/features/settings/application/embedder-port.ts`, transcription
  through `TranscriptionPort`, Agent runtime readiness and the hosted allowance
  through `AgentRuntimePort`, and MCP access through `McpAccessPort`, all
  declared in `renderer/src/features/settings/application/ports.ts`. A sibling
  feature cannot reach any of them, because a feature imports only
  `renderer/src/features/settings/public.ts`.
- A key the reader types is held in the panel's own field, submitted as a
  password input, and cleared the moment the write settles or the editor
  closes. Nothing in the renderer stores it, and no renderer module writes
  browser storage of any kind.
- The MCP bearer token is masked by default. The row shows a fixed-width mask
  rather than one dot per character, so it neither changes shape when a
  rotation lands nor counts the credential out; revealing it is an explicit
  per-view toggle that the renderer never persists. The token reaches the
  renderer only as part of a read the reader asked for, and rotation answers
  with the whole listener state so the page never guesses what took effect.
- Account OAuth starts from one place in this renderer, the search-by-meaning
  Settings panel, and only the Node server persists its session. A window
  polls the flow it started and never holds the session itself.
- The Agent runtime rows expose readiness, installation, sign-in, and reset for
  a runtime, never that runtime's own credentials.

## Persistence Invariants

- The config path is `~/.stashbase/config.json`. Successful writes are atomic
  and restrict POSIX modes to the owning user; readers validate and normalize
  domain values before exposing them.
- A strict read or write reports malformed, inaccessible, or unwritable state.
  A fallback read may preserve app availability but must not pretend a failed
  write persisted. Folder membership, recents, favorites, and seed-state
  mutations use the strict path so unreadable configuration is never replaced
  with fallback defaults.
- A durable write stays backward-readable, safely ignorable, or explicitly
  migratable, so a previous release can still read the file it finds. A domain
  read normalizes what it does not recognize instead of failing, an unknown key
  a newer build wrote is dropped from a read rather than refused, and a
  read-modify-write helper preserves the config domains it is not about.
  Retired fields are documented in place and ignored rather than deleted from
  existing files. The write direction is strict for the same reason. An unknown
  key accepted into `~/.stashbase/config.json` would be read back by every
  later merge, so domain routes parse the request body against a registered
  wire schema and refuse anything outside it.
- Turning the automatic-check preference on is a write followed by a re-read
  that reports the state main now stands behind, and a failed write leaves the
  switch where it was rather than showing a choice that was never stored.
- Every preference route in this contract validates against a schema under
  `shared/protocols/http/`, and both ends of the call use the same module.
  `shared/protocols/http/onboarding.ts` and
  `shared/protocols/http/workspace-preferences.ts` are the two whose shape a
  reader's own choice reaches directly.
- Agent Instructions are one bounded packaged default per scope plus an
  optional saved customization for that scope, and they live in the same config
  file. Reads fail soft during Agent startup, saves use the strict path, and
  removing membership clears only that folder's entry. Resolution, the two
  packaged defaults, and the separate internal routing policy belong to
  [Agent Runtime](agent-runtime.md).
- The app never changes user-managed filesystem ownership, flags, or ACLs to
  repair an unwritable config directory. Errors name the user-actionable config
  location without leaking atomic temporary paths.
- Migration is idempotent and loss-averse. Invalid legacy state must not erase
  a valid current value or silently select a different provider.
- BYOK credentials, the refreshable Supabase account session, and the active
  embedding source persist independently. Switching between account and BYOK
  retains the inactive credential and never silently falls back after a
  provider failure. The retired local source is a one-way, pre-daemon startup
  migration: select a valid account session first, otherwise a stored BYOK
  credential, otherwise clear the explicit source so searching by meaning is
  not set up. New local selections are rejected.
- Every OAuth flow records its initiating purpose. Account and Agent sign-in
  establish identity only; only the explicit choice of hosted search by meaning
  may activate `stashbase-account`, reset the indexer, or begin backfill.
- Account access and refresh tokens are Node-only configuration. They never
  cross renderer HTTP responses or the Node/Python boundary; Python receives a
  random per-process loopback bearer credential instead.
- Google display name and avatar URL are optional display-only session fields.
  Refreshes and legacy-session hydration preserve known valid values when
  provider metadata is absent or unavailable; sign-out clears them with the
  session. They never affect authorization, quota ownership, or embedding
  source selection, and raw provider metadata never crosses the account API.
- Avatar URLs the renderer could request are same-origin. Node accepts only
  HTTPS Google profile images from the exact allowed host and bounds redirects,
  time, bytes, and raster content type; failure remains an ordinary
  initials/icon fallback and never becomes a general URL proxy or account
  failure.
- The OpenCode provider config likewise receives only a random process-local
  broker key scoped to one live Agent session. The hosted Agent allowance
  response may cross to Settings only as profile alias, remaining percentage,
  token totals, and seven-day window timestamps; no monetary amount, provider
  pricing, account token, or model request is returned to the renderer.
  The OpenCode child inherits only non-secret launch/locale/TLS plumbing, not
  ambient provider keys, proxy credentials, or Node/Electron injection flags.
- Refresh demand for one account session is single-flight. A refresh may
  update or clear only the exact session it started from; a stale completion
  cannot overwrite or sign out a newer session.
- Browser provider login uses PKCE. Node generates and retains the verifier,
  accepts the short-lived authorization code only on a loopback callback, and
  exposes an opaque flow id plus pending/complete/error state to the renderer.
  Node associates that flow with the initiating window identity. Renderer
  polling updates account state but never steals focus from the callback page.
  Before opening the app, the page records return intent against its opaque
  local flow; the app-return deep link itself remains a fixed, data-free action
  and never carries a flow id, provider code, or account token. The exact
  Electron handler focuses the associated live window and authenticates its
  Node-side acknowledgement with a random per-launch child-process token;
  browser blur, visibility changes, and unauthenticated loopback requests are
  not proof that the app opened.
- Concurrent MCP listener transitions serialize and roll active exposure back
  if persistence fails.
- Clipboard-image monitoring defaults off for missing, legacy, malformed, or
  unreadable capture settings. The renderer enables Electron monitoring only
  after reading an explicit persisted opt-in, and it reports the case where the
  write persisted but the desktop watch did not apply as a warning rather than
  a failure. Turning it off stops polling and later offers; accepting a
  resulting import remains a separate user action.
- An offer needs three things at once, decided in
  `electron/clipboard-watch-policy.cjs`. The opt-in is on, the window is
  focused, and the Agent composer is not focused. The renderer forwards
  composer focus to the desktop for exactly that reason, so an offer never
  races a paste the reader aimed at the composer.
- Automatic update checking defaults on for missing, legacy, or invalid update
  settings. Turning it off cancels future scheduled checks without cancelling
  a download already requested by the user. An automatic check never grants
  download or installation; an explicit grant is what authorizes the bounded
  download/install/relaunch operation.
- Updating configuration invalidates or reconciles only the dependent runtime:
  appearance updates the renderer, capture updates the Electron clipboard
  monitor, update checks refresh the Electron update scheduler, embedding
  affects semantic readiness, transcription affects preparation, and MCP HTTP
  settings affect the listener. Ordinary browsing and keyword search remain
  available on failure. Embedding diagnostics distinguish missing
  authorization, exhausted hosted credits, and a configured runtime that is
  still recovering; they never tell a signed-in user to select an account or
  key merely because the broker is temporarily unavailable.

## Settings Surface

Sections are a registry. `renderer/src/features/settings/ui/settings-types.ts`
fixes the section ids, so a section that is not one of them cannot be
registered and the mistake fails to typecheck instead of rendering an empty
pane. `renderer/src/features/settings/ui/managed-settings.tsx` is the whole
list in nav order, and a section whose Port is absent is registered as
unavailable rather than dropped, so the nav does not change shape between the
desktop app and a host that lacks a capability.

Settings is a modal a session may never open, so
`renderer/src/features/settings/ui/settings.tsx` defers the panels until one is
asked for. Below a compact window width the nav rail becomes a drawer, and the
shell measures real window width for that rather than reading an ambient size
variant that nothing drives.

Every panel hook shares one command primitive
(`renderer/src/features/settings/hooks/use-settings-command.ts`). It owns the
abort lane, the mutation over it, the refusal read into a sentence and a tone,
and the busy flag, so a panel hook states only what its command calls and what
its answer does to the cache. Lanes are independent, so two rows' writes never
cancel each other, and leaving a panel aborts whatever is still open. A read
that polls while the server is still working declares the interval and its own
idea of busy and stops the moment that is false.

A panel that holds a value optimistically also names what to put back. The
capture opt-in and the MCP Docker opt-in both cancel the read in flight first,
hold the previous value, and restore it on refusal, and the MCP path refuses to
restore an attempt that a newer write has already answered past.

Every reader-facing sentence comes from a per-kind map, not from a transport.
`renderer/src/features/settings/application/failure-messages.ts` covers the
whole ladder, so adding a failure kind fails the build there instead of
shipping a blank.

## Appearance

Three preferences, one shape. Theme is `system`, `light`, or `dark`; interface
size and reading text size are each `small`, `default`, or `large`. One table,
`APPEARANCE_ROWS` in
`renderer/src/features/settings/domain/appearance.ts`, carries every field, its
row title, its detail sentence, and its choice labels, and it is the only list
of labels. The panel maps that table and holds no per-preference branch, so a
fourth preference is one entry plus one field on the wire.

A change paints the window before it is saved and saves without a spinner. The
rollback rule is the part to get right: each write bumps a revision and the
rollback target is the last triple the server confirmed, never an optimistic
one, so an older write that fails after a newer one started changes nothing.
The applier writes the document root and posts to a broadcast channel, which
does not deliver to the poster, which is why publishing does both. Other open
windows follow through that channel rather than through server window context.
The subscription is established before the first read, so a save landing
mid-request wins and a late read never repaints the window with the appearance
the reader just changed away from.

Interface size is one multiplier rather than a second ladder. It scales each
chrome type step where that step is declared, so it composes with the compact
density attribute instead of needing a combination for each pairing. Reading
text size is deliberately outside that multiplier and outside the chrome ramp
entirely: a reader who enlarged the furniture keeps the prose size they chose.
The Markdown reading and editing surface is the only reader of it, which
matches the scope this preference has always had. The code editor and the
plain-text viewer share one theme on the chrome ramp and follow interface size.

Applying the saved preferences before the window's first paint is not
implemented; see Known Gaps.

## Software Updates

General names the running build, says where the update has got to in one
sentence, offers a manual check, and owns the automatic-check switch. The
renderer never writes that preference over HTTP. It asks Electron main, which
writes `/api/updates/preferences` and re-reads it into the update scheduler as
one operation, so a window cannot show the switch one way while the scheduler
runs the other. Both controls are locked while the updater is already working,
because one command reaches it at a time.

The Updates feature owns every sentence about updating and Settings may not
import it, so the row it renders is named in
`renderer/src/shared/domain/software-update.ts` and filled in by composition.

## Search Setup Invitation

The invitation to set up search by meaning is one-time and application-wide,
never per folder. The offer appears once, at the first folder a reader
activates, and a completed or declined choice is remembered across every later
folder and every relaunch. Declining costs no local functionality. Keyword
search, reading, editing, preparation, and Wiki Pages are all independent of
embedding authorization, and Build Wiki has no setup request or correlated
result.

- The answer is a durable server-side preference. `OnboardingPreferences` in
  `shared/preferences.ts` stores the notice revision the reader answered, over
  `/api/onboarding`. Storing the revision rather than a boolean is what lets a
  materially changed invitation be re-offered deliberately by raising the
  revision this build sends; the server only stores the number it is given, so
  the current revision is app policy rather than wire vocabulary.
- It is deliberately not browser storage. A decline has to survive a relaunch
  and reach every window, and this renderer writes no browser storage anywhere.
  A folder-scoped skip left over from the retired per-folder model is not
  migrated. It is ignored, and the reader is offered the application-wide
  invitation once.
- The decision is a pure function in
  `renderer/src/features/settings/domain/search-setup-invitation.ts`, which
  answers `offer` only when the stored answer has loaded, the active folder's
  readiness has said an embedding source is not configured, the stored revision
  is older than this build's, and a folder is active. Both unknowns are
  modelled as unknown rather than false, so a reader who is already set up
  never sees the offer flash while the answers are still in flight.
- Answering is recorded on either path, because a reader who was shown the
  invitation has answered it whether they took it up or declined. Closing is
  local state rather than a read of that write, so nobody watches a round trip
  to dismiss a notice. A failed write leaves the stored answer alone and the
  invitation returns on a later launch, which is the safe direction to fail.
- The invitation is a non-blocking notice in the strip above the workspace and
  deliberately not a dialog. Onboarding must not gate first value behind a
  retrieval choice, and a modal between the reader and the files they just
  opened is exactly that gate. It is last in the strip, because a refusal of
  something the reader did try is more urgent than an offer of something they
  have not asked for.
- Taking it up records the answer and opens the search-by-meaning Settings
  section, which is why the offer is composed where the Settings command lives
  (`renderer/src/app/composition/commands/use-workspace-commands.ts`) and
  presented by `renderer/src/app/composition/folder/use-workspace-notices.ts`.
- Two manual routes back remain. The **By meaning** search mode says that
  search by meaning needs setting up and offers **Open Settings** whenever it
  is the selected mode, and the sidebar's own Settings entry opens the section
  directly. **Known Gap.** There is no persistent Files-panel setup action in
  this renderer. The Files surface signals that the folder needs attention but
  carries no route into setup, so a reader who declined and never selects the
  By meaning mode reaches it only through Settings.

## Product Vocabulary

The product says search by meaning, never AI Index. The Settings section is
labeled Search by Meaning and its source group is **Source**, not Source file.
Hosted search credits are separate from the Wiki Agent's seven-day allowance,
and the two are said in different places. The search-by-meaning panel describes
included monthly credits for embeddings, and the Agents panel describes the
standing 7-day Agent allowance. Do not merge them into one quota sentence.

The directory `renderer/src/features/settings/ui/ai-index/` still carries the
retired name on disk, and so do the section id every caller passes and the
panel component inside it. Describe the panel by what it does and cite the real
path. Renaming them is a separate change.

## Known Gaps

- Saved appearance is not applied before the window's first paint. The applier
  runs after React mounts, so a window opens on the operating system's scheme
  and the chrome ramp's default, then repaints into a pinned theme or a chosen
  size. A strict Content Security Policy rules out an inline script in the
  entry document, so closing this means handing the snapshot to the window from
  the host before it loads.
- Hosted account identity has no section of its own. Signing in lives on the
  embedder Port behind the Search by Meaning section, because that section was
  the first to need it, so a runtime row that needs an account hands the reader
  to Search by Meaning rather than to an account surface. The hand-off works
  and is tested; the placement is what remains wrong, and it stays that way
  until account earns its own lifecycle inside Settings.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Persistent Interface | strict/fallback read and write plus domain getters/setters in `server/app-config.ts`, over the preference shapes in `shared/preferences.ts` |
| Domain owners | `server/agent-instructions.ts`, `server/mcp-http-settings.ts`, `server/hosted-account.ts`, `server/hosted-embedding-broker.ts`, `server/hosted-agent-broker.ts`, embedding and transcription configuration Modules |
| HTTP Adapters | `server/routes/agent-instructions.ts`, `appearance.ts`, `capture.ts`, `updates.ts`, `workspace-preferences.ts`, `onboarding.ts`, `account.ts`, `embedder.ts`, `transcription.ts`, `mcp.ts` |
| Wire schemas | `shared/protocols/http/onboarding.ts` and `shared/protocols/http/workspace-preferences.ts` for the two preferences a reader's own choice reaches, with the rest of the registered set under `shared/protocols/http/` |
| Renderer Interface | `renderer/src/features/settings/public.ts`, bound once in `renderer/src/app/dependencies.ts` |
| Software updates | `renderer/src/features/updates/`, whose phase table owns every sentence, with the Settings row shape in `renderer/src/shared/domain/software-update.ts` |
| Renderer Ports | `renderer/src/features/settings/application/ports.ts` and `application/embedder-port.ts`, with the shared read keys in `application/queries.ts` and the sentence maps in `application/failure-messages.ts` |
| Renderer Adapters | `renderer/src/features/settings/infrastructure/agent-runtime-api.ts`, `appearance-api.ts`, `capture-api.ts`, `embedder-api.ts`, `mcp-access-api.ts`, `onboarding-api.ts`, `transcription-api.ts` |
| Panel controllers | `renderer/src/features/settings/hooks/use-settings-command.ts` plus one hook per capability in `hooks/use-appearance.ts`, `hooks/use-capture.ts`, `use-embedder.ts`, `use-mcp-access.ts`, `use-transcription.ts`, `use-agent-runtimes.ts`, `use-search-setup-invitation.ts` |
| Settings views | `renderer/src/features/settings/ui/settings.tsx`, `ui/settings-types.ts`, `ui/managed-settings.tsx`, `ui/shell.tsx`, `ui/rows.tsx`, and the panels `ui/general/general-panel.tsx`, `ui/appearance/appearance-panel.tsx` over its `ui/appearance/preset-choice.tsx`, `ui/agents/agents-panel.tsx`, `ui/ai-index/ai-index-panel.tsx`, `ui/transcription/transcription-panel.tsx`, `ui/mcp/mcp-access-panel.tsx` |
| Setup invitation | `renderer/src/features/settings/domain/search-setup-invitation.ts`, `hooks/use-search-setup-invitation.ts`, `infrastructure/onboarding-api.ts`, composed by `renderer/src/app/shell.tsx` and `renderer/src/app/composition/commands/use-workspace-commands.ts`, presented by `renderer/src/app/composition/folder/use-workspace-notices.ts` and `renderer/src/app/composition/layout/workspace-notices.tsx` |
| Appearance | the row table and surface mapping in `renderer/src/features/settings/domain/appearance.ts`, the surface type in `renderer/src/shared/domain/appearance.ts`, the document applier and broadcast in `renderer/src/shared/runtime/appearance-surface.ts`, applied for the window by `renderer/src/app/composition/use-appearance-surface.ts`, with the token scopes in `renderer/src/globals.css` |
| Settings domain | `renderer/src/features/settings/domain/embedder.ts`, `domain/mcp-access.ts`, `domain/agent-catalog.ts`, `domain/agent-runtime-status.ts`, `domain/transcription.ts`, `domain/transcription-status.ts` |
| Capture runtime Adapter | `renderer/src/platform/electron/capture.ts` and the clipboard boundary in `electron/main.cjs` over `electron/clipboard-watch-policy.cjs` |
| Update runtime Adapter | `electron/update-manager.cjs`, `electron/update-install-strategy.cjs`, `electron/update-window-barrier.cjs`, and `electron/main.cjs` |
| Focused evidence | `server/app-config.test.ts`, `server/agent-instructions.test.ts`, `server/hosted-account.test.ts`, `server/__tests__/hosted-agent-broker.test.ts`, `server/__tests__/mcp-http-settings.test.ts`, `server/routes/onboarding.test.ts`, `server/routes/workspace-preferences.test.ts`, `server/routes/appearance.test.ts`, `shared/protocols/http/appearance.test.ts`, `electron/clipboard-watch-policy.test.cjs`, `electron/update-manager.test.cjs`, `renderer/src/features/settings/domain/appearance.test.ts`, `renderer/src/features/settings/domain/search-setup-invitation.test.ts`, `renderer/src/features/settings/hooks/use-search-setup-invitation.test.ts`, `hooks/use-appearance.test.ts`, `hooks/use-embedder.test.ts`, `hooks/use-mcp-access.test.ts`, `hooks/use-capture.test.ts`, `hooks/use-transcription.test.ts`, `hooks/use-agent-runtimes.test.ts`, `hooks/use-settings-command.test.ts`, `renderer/src/features/settings/infrastructure/embedder-api.test.ts`, `infrastructure/mcp-access-api.test.ts`, `infrastructure/agent-runtime-api.test.ts`, `infrastructure/capture-api.test.ts`, `infrastructure/transcription-api.test.ts`, `renderer/src/shared/runtime/appearance-surface.test.ts`, `renderer/src/app/composition/use-appearance-surface.test.ts`, `renderer/src/features/updates/domain/update-offer.test.ts`, `renderer/src/features/updates/infrastructure/updates-bridge.test.ts`, `renderer/src/features/updates/hooks/use-update-notice.test.ts`, `renderer/src/features/updates/hooks/use-software-update.test.ts`, and the panel suites `renderer/src/features/settings/ui/shell.test.tsx`, `ui/general/general-panel.test.tsx`, `ui/appearance/appearance-panel.test.tsx`, `ui/agents/agents-panel.test.tsx`, `ui/ai-index/ai-index-panel.test.tsx`, `ui/transcription/transcription-panel.test.tsx`, `ui/mcp/mcp-access-panel.test.tsx` |

## Validation

Run:

```bash
pnpm typecheck
pnpm test:config
pnpm test:mcp
pnpm test:renderer
pnpm test:updates
```

Run `pnpm test:protocols` when a preference wire schema changes, and
`pnpm check:web` when a Settings panel changes layering or module shape.

Journey automation retired with the Playwright suites. Prove Settings
navigation, credential entry, and native capture opt-in with focused renderer
tests and a driven runtime pass. Run the affected conversion, Agent, or MCP
suite when a setting changes its runtime behavior. Never use a real credential
in a fixture or diagnostic.

Related journeys: [J01](../design-docs/user-journeys.md#j01-complete-onboarding-and-reach-first-value),
[J04](../design-docs/user-journeys.md#j04-prepare-a-hard-to-read-file),
[J05](../design-docs/user-journeys.md#j05-search-and-open-source-evidence),
[J06](../design-docs/user-journeys.md#j06-start-and-continue-an-agent-chat), and
[J08](../design-docs/user-journeys.md#j08-connect-an-external-agent-through-mcp),
plus [J11](../design-docs/user-journeys.md#j11-turn-a-conversation-into-a-project)
for the owned default project location and
[J12](../design-docs/user-journeys.md#j12-build-wiki-pages-from-a-local-folder)
for first-folder activation of search by meaning and independent Wiki Page
builds.
Related contracts: [MCP Access](mcp-access.md), [Agent Runtime](agent-runtime.md),
[Renderer Workspace](renderer-workspace.md), and
[Data Lifecycle](data-lifecycle.md).

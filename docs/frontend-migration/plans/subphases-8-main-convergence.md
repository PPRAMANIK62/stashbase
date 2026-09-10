# Subphase 8 — Main Convergence

Tasks 62–69, 72, and 73 absorb the product work that landed on `main` while the
replacement was being built, and restate replacement evidence after the
Playwright suites were retired. Tasks 57–59 in
[Subphase 7](subphases-7-journey-proof-and-cutover.md) are blocked by this
subphase. File order does not imply execution order; the blocker lines do.

`main` moved 349 files after the branch point, 143 of them under `web-src`.
Five product surfaces, two journeys, and one persisted-state model arrived
with no counterpart in `renderer`. Presence was checked by symbol rather than
assumed: `showHidden`, `ImportGitHub`, `SimilaritySearch`, `ComposerPills`,
`AgentInstructions`, and every Gallery identifier resolve to zero files under
`renderer/src`.

A Retain disposition is a decision here, not a default. `main` redesigned
chrome that the Fluid Functionalism rebuild already solves differently, so an
arrived surface may be satisfied by a different composition, or refused, so
long as the product outcome and its journey hold.

Three arrived surfaces are refused and carry no task here: `main`'s launcher
and composer chrome rework, its resizable outline dock, and its agent-panel
and retrieval behavior fixes. The replacement keeps its own composition, and
task 64 records each as a Remove disposition with that reason. A later
decision may adopt any of them on the replacement's terms.

## 62 — Retire Playwright evidence and restate replacement proof

**Blocked by:** none.

**Status:** Complete.

Remove the whole Playwright surface and name what proves the replacement in
its place. The `e2e` tree, the Playwright configuration, the visual-baseline
workflow, the E2E jobs in source CI, the E2E focus checker, both Playwright
dependencies, the nine `test:e2e:*` scripts, and the `typecheck:e2e` leg of
`pnpm typecheck` all go. UI Regression Testing is retired as a review
contract: its route leaves the review guide, its path joins the retired-path
list in the docs checker, and `e2e` leaves both the referenced-path prefix
set and the test-inventory scan roots.

A decision record replaces the success criterion that reads "the existing
release-blocking Electron and Playwright journeys run against the new
production entry". The replacement proof for a cross-process slice becomes
focused renderer domain, adapter, hook, component, and composition tests,
story accessibility, the Electron boundary suites, `pnpm test:electron:smoke`,
and a driven runtime pass through the real app recorded in the owning task
entry. Tasks 57 and 58 inherit that definition, and every task below states
its evidence in those terms.

Removing journey automation removes the only automated proof that Electron
boots, that `app://` serves under the strict policy, that the preload bridge
authorizes, and that a folder opens end to end. The decision record names that
loss explicitly rather than leaving a retired command to imply a gate that no
longer runs.

[Decision 0018](../decisions/0018-retire-playwright-journey-evidence.md)
records the retirement, what replaces it, and what is lost.

The docs and inventory gates were already red on this branch before the
removal, from scripts retired in earlier renderer work and from three test
files wired into no command. Both are repaired here rather than left for the
cutover to inherit.

Evidence: `pnpm test:docs`, `pnpm test:inventory`, `pnpm typecheck`,
`pnpm lint:web`, `pnpm test:renderer`, `pnpm test:renderer-architecture`,
`pnpm build:web`, `pnpm test:library-files`, `pnpm test:electron`, and
`pnpm test:electron:smoke` all pass. Source CI carries one job.

## 63 — Merge main and reconcile shared Interfaces

**Blocked by:** 62.

**Status:** Complete.

Merge `main` and settle the shared server, Electron, and protocol surface.
Task 62 runs first so the branch never carries a red suite: `main` touched 31
files under `e2e`, and against an already-deleted tree they resolve as
modify/delete in one command instead of auto-merging into files that are then
deleted anyway.

Eleven files conflict. The retired chunk-budget and icon-generation scripts
keep the branch's deletion, because `renderer` owns both jobs now. The
package manifest takes both sides. The seven
semantic conflicts reconcile `main`'s hidden-visibility flag through the file
listing, Agent Instructions injection in the runtime adapters, the gallery
proxy, and the Electron slow-listener reprobe against the replacement's
protocol changes.

Six routes arrive with no renderer consumer yet: agent instructions read and
write, workspace preferences read and write, the gallery index and image
proxy, the GitHub import request, and file stat. Register them in the shared
protocol so later tasks consume validated wire schemas rather than widening
one when they need it.

Two crossings needed a decision rather than a side. The workspace listing now
echoes the visibility the server applied, so `workspaceFilesSchema` gains a
required `showHiddenFiles` and the handler keeps parsing through it; an
explicit member listing is Agent-facing and always reports false. Library
semantic results keep the replacement's server-resolved folder and relative
path while adopting `main`'s `mode` and `folder` fields. The panel protocol
gains `set-similarity-search` as a schema variant rather than the inline union
`main` extended, and the sandboxed window from Decision 0010 is kept whole
against `main`'s unsandboxed one.

Folder entry no longer seeds `AGENTS.md`. `main` removed that write, which
closes the instruction-seeding Known Gap the file-transactions contract
carried.

Evidence: `pnpm test:docs`, `pnpm test:inventory`, `pnpm typecheck`,
`pnpm lint:web`, `pnpm test:renderer`, `pnpm build:web`, `pnpm test:protocols`,
`pnpm test:config`, `pnpm test:library-files`, `pnpm test:agent`,
`pnpm test:retrieval`, `pnpm test:conversion-scheduler`, `pnpm test:mcp`,
`pnpm test:electron`, and `pnpm test:electron:smoke` all pass.

## 64 — Assess arrived capabilities and register the new journeys

**Blocked by:** 63.

**Status:** Complete.

Classify every arrived surface in the capability ledger before any of it is
implemented. Hidden-file visibility, GitHub import, Agent Instructions, Wiki
Pages, the Gallery, the search-by-meaning onboarding model, and the retired AI
Index vocabulary each take a Retain, Change, or Unresolved disposition with
its reason. The launcher and composer chrome, the resizable outline dock, and
the agent-panel and retrieval behavior fixes are recorded Remove, so a later
reader can see they were considered rather than missed.

`main` shipped its own J12 and J13 journey and coverage sections, so only the
ledger needed the new rows; the docs checker validates J01 through J13.

Ten capabilities are assessed. Hidden entry visibility, public repository
import, Agent Instructions, Wiki Pages, and the Gallery are Retain. The
search-by-meaning onboarding model and the product vocabulary are Change. The
launcher and composer chrome, the resizable outline dock, and the agent-panel
and retrieval behavior fixes are Remove, each with its reason, so a later
reader sees they were considered rather than missed.

[Decision 0019](../decisions/0019-one-time-search-setup-invitation.md) records
the one persisted-state change, including that a stored folder-scoped skip is
ignored rather than translated, and unblocks task 66.

J10 and J11 remain Not assessed. They are not arrivals; tasks 57 and 58 own
them, and task 59 needs them along with the two performance gates that still
have no recorded baseline.

Evidence: `pnpm test:docs`, and an assessed ledger row carrying a disposition
and a reason for each arrived capability.

## 65 — Retire the AI Index vocabulary

**Blocked by:** 64.

**Status:** Complete.

`main` renamed AI Index to search by meaning, renamed Source file to Source,
and separated search credits from the Wiki Agent's seven-day allowance. The
replacement still ships the retired term in user-facing copy, including
retrieval failure messages, readiness titles, and the Similar mode's
unavailable title.

Four renames landed. AI Index becomes search by meaning throughout retrieval
and Settings copy. Exact text search becomes Keyword search, and the two search
modes take `main`'s labels, By keyword and By meaning, since the mode names and
the prose describing them have to agree. The hosted embedding quota becomes
credits while the Agent's fixed seven-day quota stays an allowance, which is
the distinction `main` drew. The `stashbase` runtime is labelled Wiki Agent
rather than Built-in.

Source file needs no sweep: the glossary keeps it for explanatory prose and
reserves Source for headings and controls.

Identifiers are out of scope and unchanged. The Settings section keeps the
`ai-index` id and its module path, because the id is navigation state rather
than language; renaming it is a refactor, not a vocabulary change.

Server copy is unchanged, and one inconsistency is left standing for its
owner: the library search route still refuses with a hosted *allowance*
message where the renderer and the rest of `main` now say credits.

Evidence: focused retrieval domain and UI tests, Settings domain and panel
tests, story accessibility, `pnpm test:renderer`, `pnpm typecheck`,
`pnpm lint:web`, `pnpm build:web`, and a search proving no renderer-visible
occurrence of the retired vocabulary remains.

## 66 — Rebuild the one-time setup invitation for search by meaning

**Blocked by:** 65.

**Status:** Complete.

The skip was folder-scoped durable state and `main` deleted both of its
accessors. The offer is now a one-time invitation at the first folder
activation, remembered across every later folder and relaunch, with the By
meaning search mode, a persistent Files-panel action, and Settings as the
manual routes back. Declining never costs local functionality and never
prevents pending Wiki Pages from being built.

This changes persisted state and rewrites the J01 primary flow.
[Decision 0019](../decisions/0019-one-time-search-setup-invitation.md) fixes
the model, including that a stored folder-scoped skip is ignored rather than
translated. Update J01 and its coverage row in the same change.

The answer is a durable server-side preference rather than `main`'s
`localStorage`, which its own fallback comment admits can be rejected so that
"the setup can reappear on a later launch". `OnboardingPreferences` already
existed for versioned one-time notices and `/api/onboarding` already served it,
so the invitation records the revision it answered and a raised revision
re-offers deliberately. The replacement uses no browser storage anywhere; this
would have been its first exception, for the one kind of state the architecture
already routes through a server-owned port.

Writing that preference is now validated. The route previously spread an
unvalidated body into `config.json`, so any key a caller sent became durable
state; it parses against a registered wire schema and refuses an unknown key,
an empty patch, or a revision that is not a whole count.

The invitation is a non-blocking notice in the strip above the workspace, not a
dialog. Decision 0019 argues that onboarding must not gate first value, and a
modal between the reader and the files they just opened is that gate; the strip
already carries what the window says about things the reader did not ask about,
so the offer joins it and sits after any refusal. Taking it up opens the
Settings section that owns the two sources rather than carrying a second copy
of the provider and key UI.

Closing the invitation is local state, not a read of the write. The reader has
answered the moment they click, so a failed save leaves the stored answer alone
and the invitation returns on a later launch, which is the safe direction to
fail. The offer also holds until the folder's readiness has answered: treating
an unknown readiness as unconfigured showed the invitation for a moment and
then withdrew it from a reader who was already set up.

J01 already described this model: it arrived with the merge. Only the evidence
needed recording.

Evidence: focused domain tests for every offer state including a raised
revision and an unanswered readiness, notice-strip tests for the offer's
action, decline label, and ordering behind a refusal, hook tests for the offer, the single durable answer however many
times the reader clicks, and the refusal to offer before the stored answer has
loaded, protocol tests for the read and the strict write, route tests proving
an unknown or malformed preference is refused rather than persisted, plus
`pnpm test:renderer`, `pnpm test:config`, `pnpm test:protocols`,
`pnpm test:inventory`, `pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`,
and `pnpm test:docs`.

## 67 — Surface hidden files and folders on demand

**Blocked by:** 64.

**Status:** Complete.

One durable application-level preference over the workspace-preferences
routes, consulted by the file listing, with the server keeping classification
authority. Eligible user-owned dot-directories and their descendants join the
tree and Quick Open with their declared capability and a subtle
non-disabled distinction. VCS databases, product state, derived artifacts,
dot-notes, and junk metadata never surface in either mode, and hidden
excluded caches stay bounded and non-expandable. Off is both the default and
the recovery for invalid stored state.

The listing echoes the effective flag so every window's menu tracks server
truth, and the toggle bumps the shared tree version so other windows refetch
on their normal status poll. Turning it off drops hidden rows from the tree,
keyboard order, selection, and Quick Open without closing open tabs.

The control sits on the file tree's own space menu rather than a new panel
header. It is a property of the whole tree, the space menu already exists for
tree-wide actions, and task 64 recorded `main`'s launcher and header chrome as
Remove; adding a header button here would have reintroduced it by the back
door. The row announces itself as a checkbox and its icon carries the state.

The listing echoes the visibility the server applied and the menu reads that
echo, so a window can never show rows one way and its menu the other. A
successful write invalidates the open folder's listing directly instead of
waiting for the shared tree-version poll, because the reader just asked for it
and up to eight seconds of nothing would read as a broken control; other
windows still converge on that poll. A refused or failed write changes
nothing on screen.

The write route is guarded the way task 66 guarded its sibling. It previously
forwarded the whole body to durable configuration after checking one field's
type, so an unknown key was persisted and an empty body counted as a write.
It now parses against a registered wire schema and refuses both.

Quick Open needed no filter of its own. It reads the same listing the tree
does and ranks by relevance alone, so the Workbench visibility reaches it
without a second reader to keep in step. Turning the visibility off likewise
cannot close a tab opened from a hidden path: nothing in the documents runtime
reads the listing. Both were verified rather than assumed, because both are
product guarantees that a later listing-driven reconcile would silently break.

Evidence: focused protocol tests for the tolerant read and the strict write;
route tests proving an unknown key, a non-boolean, and an empty body are all
refused rather than persisted; hook tests for reading the applied visibility
rather than holding one, asking for the opposite, ignoring a second gesture
while a write is open, and leaving the applied value alone when a write is
refused; menu tests for the checked state matching the listing and for the row
being absent when no folder is listed; a Quick Open composition test proving a
hidden entry is offered, opens, leaves the picker when the visibility goes
off, and keeps its open tab; plus `pnpm test:renderer`, `pnpm test:config`,
`pnpm test:protocols`, `pnpm test:inventory`, `pnpm typecheck`,
`pnpm lint:web`, `pnpm build:web`, and `pnpm test:docs`.

## 68 — Import a public GitHub repository

**Blocked by:** 64.

**Status:** Complete.

J02 gains a URL-paste route from the Library switcher and the folder-add
menu. Canonical HTTPS owner and repository parsing, an auto-derived folder
name, a live destination preview under folder home, inline refusals for
submodules and Git LFS, and cancellation that cleans staging without touching
existing members.

The server owns cloning, isolated staging, atomic publication, registration,
and the background sync trigger. The renderer owns validation feedback and
the request lifecycle, and never learns a staging path.

The URL and destination-name rules are the server's own modules, reached
through the port rather than re-derived. The renderer's boundary rules put
repository contracts behind a feature Adapter, and a hook may reach neither a
contract nor infrastructure, so the two rules are read through
`GitHubImportPort` and mapped in the adapter. That is the architecture
answering the question correctly: inline feedback is the rule the request will
meet, and the server still parses both again, so this is feedback rather than
authority. No rule was weakened to fit the feature.

Every refusal is chosen by its code, not by the server's prose, so a private
repository, a taken destination, a missing Git, Git LFS, and submodules each
read as themselves. A code this build does not know falls back to the ladder's
own line rather than being guessed at.

The published folder is opened through the same folder lane every other change
uses, so the save barrier and the abandonment rule apply to an import exactly
as they do to picking a folder. Closing the dialog cancels an open request;
the server cleans its own staging and no partial member is published.

Entry points are the Library switcher menu and the welcome screen. Lucide has
retired its brand icons, so the row uses a repository glyph rather than a
GitHub mark.

Sharing the URL parser with the renderer put it under the replacement's
stricter compiler for the first time, which found two unchecked index reads in
the shared module; both are fixed and the server suite still passes.

Evidence: protocol tests for the request, the staging-free result, and a
refusal code this build does not know; adapter tests for the derived name, the
URL and folder-name rules, the request shape, and every refusal's sentence;
hook tests for submit readiness, the derived name, keeping a typed name when
the URL is corrected, refusing an unusable name, handing the published path
on rather than opening the folder, reporting a refusal without clearing input,
clearing it on edit, and cancelling an open request; plus `pnpm test:renderer`,
`pnpm test:library-files`, `pnpm test:protocols`, `pnpm test:inventory`,
`pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`, and `pnpm test:docs`.

## 69 — Edit Agent Instructions per scope

**Blocked by:** 64.

**Status:** Complete.

Folder scopes and the Library scope each resolve a packaged default and an
optional saved customization under the configuration's agent-instructions
key. The editor and its presence indicator follow the active Chat's scope,
and one exported scope-key helper keeps the request parameter and the effect
identity from disagreeing. Runtime adapters inject the resolved text
verbatim; the renderer never holds a resolved prompt as durable state.

The scope's identity is one function in the agent domain. The editor keys its
read on it and the transport spells `?scope=` with it, so the two cannot
disagree, which is the failure `main` fixed with a shared helper. The renderer
boundary put that helper in the domain rather than the protocol: a hook may not
read a wire module, and the adapter may reach the domain, so the domain is the
one layer both readers share.

The route's scope contract is asymmetric and the protocol says so: a read
answers with the scope object, a write sends its spelling. `resolveScope`
re-derives the scope from that string, which keeps membership authority on the
server rather than trusting a shape the renderer composed. The first draft sent
the object and would have been refused; reading the route rather than assuming
it caught that before a test could.

Saving empty restores the packaged default, which is the only way back once a
scope is customized, so the editor offers it as an action rather than leaving
it to be discovered.

Known gap: instructions bind when a session runtime is created, so an edit does
not reach a Chat that is already open. The dialog says so plainly rather than
implying otherwise. `main` refreshes a live session through a save broadcast;
carrying that across is its own change against the replacement's session
runtime, not part of this editor.

Evidence: protocol tests for the state shape, the refused scope kinds, and the
write's spelling; a domain test pinning one identity per scope and naming why
the Library's literal is unambiguous; adapter tests for both scope spellings,
the encoded folder path, the write body, and a refused response; hook tests for
reading the active scope, reading nothing unscoped, the customized indicator,
dirtiness, saving into the scope on screen, re-reading and abandoning the draft
on a scope change, restoring the default, and keeping the draft when a save is
refused; plus `pnpm test:renderer`, `pnpm test:agent`, `pnpm test:config`,
`pnpm test:protocols`, `pnpm test:inventory`, `pnpm typecheck`,
`pnpm lint:web`, `pnpm build:web`, and `pnpm test:docs`.



## 72 — Build Wiki Pages from a folder

**Blocked by:** 64, 69.

**Status:** Complete.

Complete the J12 renderer responsibilities. Building a wiki is an ordinary
visible Agent request against the active folder, with Agent Instructions
carrying the durable contract and the resulting pages landing as ordinary
local source files. Progress, refusal, and recovery read through the existing
Agent surfaces rather than a private staged-intent machine.

Most of the journey was already standing: the composer, the runtime, the
instruction injection from task 69, and the tree refresh that surfaces the
written pages. Four things were missing, and each was a way the journey could
not be reached rather than a feature it lacked.

The runtime gate replaced the whole canvas. A window with nothing ready drew a
setup screen instead of the conversation, so the request could not be written
until setup was finished — the opposite of what J12 asks. The gate is now a
notice beneath a composer that stays, holds what is written into it, and
advertises no runtime ability it cannot deliver: no attachments, skills, model,
effort, or permission mode, and no submit dispatches. `agentGate` in the agent
domain decides between `ready`, `checking`, and `setup` from the runtime the
Chat is bound to, and holds the offer back until the catalog answers, because
treating an unanswered catalog as nothing-ready shows the offer for a moment
and then withdraws it from a reader who is already set up. The gate is decided
where the session store is read: a provider switch remounts the session under
the same tab, so a parent watching only the tab id would keep a stale answer.

A gated Chat could then be stranded. The workspace runtime rebound a blank chat
to an available runtime only on the window's first start, and rebinding
discarded the session — which would have thrown away the request this task
exists to keep. A Chat no turn has left now follows the first runtime that
becomes ready whenever one arrives, and its draft and bound sources move with
it; a Chat with a transcript or a native session stays where it is, because
that is work the reader can see. `agentSessionIsUnstarted` names that condition
in the domain, and `agentSessionIsBlank` is now expressed in terms of it.
Nothing is sent on the reader's behalf when the gate lifts, which is where this
parts company with `main`'s pending intent.

Nothing told a reader the journey existed. `design-docs` calls **Your Wiki is
here.** the blank Chat's durable greeting and `web-src` shipped it; the
replacement had drifted to a generic chat prompt that names no wiki, and the
change was never recorded. It is restored. The starter row under the composer
offered three read-only questions and no way to ask for a wiki, and the
Gallery — which `product-direction` names as what teaches this by example —
only appears in a bare window. **Build my wiki** now leads the row, which is
capped at three so a suggestion does not become a menu. A starter fills and
focuses the composer rather than sending, so the visible request stays the
reader's to edit and is still exactly what the Agent receives. The label never
becomes Update: the first release claims no built, ready, or stale Wiki state,
and one label is how that promise is kept.

One accessibility defect surfaced. The composer carried `aria-expanded`, which
`textbox` may not have; the open popup is announced through the controlled
listbox and the active option instead. It had never been scored because the
workspace stories rendered before the catalog answered and were therefore
scoring the old setup screen, not the composer. The stories now wait for the
gate to lift, so they score what their names claim, and a new story covers the
gated state.

The Agent turn that writes the pages is not driven here. It writes real files
under a real account, so it stays release and Eval evidence, which is what
Journey Coverage already recorded for J12.

Evidence: domain tests for the three gate states, the held offer, and the
starter row including a folder that already has pages; workspace tests for the
gated composer keeping its request with Send unavailable and no ability
advertised, the stage-specific offer, the request surviving onto the runtime
the reader sets up, and the starter filling without sending; runtime tests for
the rebind carrying draft and sources and for a Chat that has spoken staying
put; a composition test for a request sending while the whole folder is
preparing; story accessibility over both the working conversation and the gate;
plus `pnpm test:renderer`, `pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`,
and `pnpm test:docs`. A driven runtime pass through the real application over
the debugging protocol proved the gated composer, the typed request held
through setup, and the request intact with Send enabled once a runtime was
ready.

## 73 — Browse and copy from the Gallery

**Blocked by:** 68, 72.

**Status:** Complete.

Complete the J13 renderer responsibilities. The Gallery is a shelf of
ready-made Wikis, each one a real folder with a wiki already built from it, and
Make a copy reuses the task 68 public-repository import into folder home and
opens the result in a window of its own. Reading the shelf costs a reader no
folder, no account, and no Agent runtime.

Almost all of it was already standing: the daemon's pinned-host index and image
proxy, the fallback to the bundled snapshot when a total index failure answers
with a success envelope carrying an unsupported schema, the near-fullscreen
overlay, the entry page carrying the file tree and the producing request as
copy-only text alongside the curated screenshots and Make a copy, and the
sidebar entry that opens the shop over a folder window. One thing was missing,
and it was a way the journey could not be reached rather than a feature it
lacked.

A bare window did not derive the band. It offered a **Browse the Gallery**
button onto the same overlay, so the shelf existed only behind a modal a reader
had to already want to open. That is the one thing a band cannot be. The band's
whole product job is to teach the journey by example, and it can only do that
by being on the screen before anyone clicks; `product-direction` names the
Gallery as what teaches this, and task 72 leaned on that when it capped the
starter row at three. The button is gone and the entries are on the screen.

The band's host is the welcome screen, not a Chat pane. This task was written
against `web-src`, whose bare window is a blank Chat, which is why the original
text placed the band below a blank Chat composer. The replacement has no Chat
on a bare window at all: `workspace-layout` hides the panes and shows the
welcome screen whenever no folder is open, so the bare window *is* the welcome
screen. Mounting the band there is a deliberate adaptation to the
replacement's own composition rather than a shortcut around the requirement.

The band is a third frame over the state the shop already had, not a third
shop. `useGalleryShop` holds a whole visit as one open flag and one selected
entry, and a band card sets both at once, so a card on the welcome screen lands
straight on that entry's page where the sidebar row still opens the shelf. Back
clears the entry and leaves the reader on the overlay's shelf, which is the
only home a reader who arrived through a card has. There is still one index and
one copy in flight.

The welcome screen learned nothing about the Gallery. The renderer's
`no-sibling-feature-imports` rule forbids `features/workspace` from importing
`features/gallery`, its `public.ts` included, so the band arrives as a
`ReactNode` slot composed in `app/` exactly the way the old callback did. The
screen renders the slot it is handed and stands without one.

The screen itself became a page. It was one centered column at a single narrow
measure, which a shelf cannot live inside. The hero keeps that measure and its
vertical centering when there is no band; with one, the column scrolls and the
band sits below the hero at a wider measure, because the shop's grid is
container-driven and a narrow column would hold one card per row. The band's
own heading and line keep the hero's center axis: the shelf is wider than the
hero, but two competing alignments on one screen read as two screens.

The action row above it wrapped its labels. Three icon buttons want about
482px and the hero measure was 448px, so flex squeezed them and `Button` had no
`whitespace-nowrap` to stop a squeezed label breaking in half. The primitive
holds that rule now, because a button label wrapping is never what anyone
wants; the hero measure widened one step so the row fits at rest, and the row
wraps whole buttons when a window really is too narrow. The defect predates
this task and was reached through it.

Registering J13 in `design-docs/user-journeys.md` and in Journey Coverage,
named in this task's original evidence line, is deferred under
[`docs/frontend-migration/AGENTS.md`](../AGENTS.md) rather than done here.
Migration scaffolding does not update the permanent Shipping record, and
Journey Coverage waits for the maintainer's finalization. The full driven pass
from the band through Make a copy belongs with that deferred evidence, so the
ledger row is Building rather than Proven.

The band itself was driven in the real application over the debugging
protocol. A window opened against a clean profile derived the shelf on its
welcome screen with no folder open and no click, and a card opened that
entry's page carrying its tree, its producing request, and Make a copy. Make a
copy was not pressed: it downloads a public repository and registers a real
folder, which is why it stays with the deferred evidence. Composition was
reviewed by eye from that pass.

Evidence: a composition test proving the published entry is on the welcome
screen with no folder open and no click at all, and that a band card opens that
entry's page rather than the shelf; the existing composition test for the
sidebar entrance and the copy, unchanged; a workspace test for the welcome
screen rendering the slot it is handed and standing without one; plus
`pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:renderer`,
`pnpm test:protocols`, `pnpm test:library-files`, and `pnpm test:docs`.

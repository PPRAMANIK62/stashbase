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

**Status:** Not started.

Classify every arrived surface in the capability ledger before any of it is
implemented. Hidden-file visibility, GitHub import, Agent Instructions, Wiki
Pages, the Gallery, the search-by-meaning onboarding model, and the retired AI
Index vocabulary each take a Retain, Change, or Unresolved disposition with
its reason. The launcher and composer chrome, the resizable outline dock, and
the agent-panel and retrieval behavior fixes are recorded Remove, so a later
reader can see they were considered rather than missed.

Add the J12 and J13 rows to the ledger and their evidence rows to Journey
Coverage. The docs checker requires exactly one journey heading and one
coverage row per `Jxx`, so the merge leaves `pnpm test:docs` red until both
journeys are registered.

Record a decision for anything that changes persisted state, a trust
boundary, a cross-process Interface, or a product outcome. The onboarding
model in task 66 is known to qualify.

Evidence: `pnpm test:docs`, and an assessed ledger row carrying a disposition
and a reason for each arrived capability.

## 65 — Retire the AI Index vocabulary

**Blocked by:** 64.

**Status:** Not started.

`main` renamed AI Index to search by meaning, renamed Source file to Source,
and separated search credits from the Wiki Agent's seven-day allowance. The
replacement still ships the retired term in user-facing copy, including
retrieval failure messages, readiness titles, and the Similar mode's
unavailable title.

Sweep renderer copy, stories, and tests. Server field names stay as the merge
left them; this task owns renderer-visible language only, so a rename that
would cross the wire belongs to a decision instead.

Evidence: focused retrieval domain and UI tests, story accessibility,
`pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`, and a search proving no
renderer-visible occurrence of the retired vocabulary remains.

## 66 — Rebuild the one-time setup invitation for search by meaning

**Blocked by:** 65.

**Status:** Not started.

The skip was folder-scoped durable state and `main` deleted both of its
accessors. The offer is now a one-time invitation at the first folder
activation, remembered across every later folder and relaunch, with the By
meaning search mode, a persistent Files-panel action, and Settings as the
manual routes back. Declining never costs local functionality and never
prevents pending Wiki Pages from being built.

This changes persisted state and rewrites the J01 primary flow, so it lands
with a decision record rather than as a port. Update J01 and its coverage row
in the same change.

Evidence: focused domain, adapter, hook, component, and composition tests for
the one-time transition, each manual route back, and persistence across
relaunch; J01 and Journey Coverage updates; `pnpm typecheck`,
`pnpm lint:web`, `pnpm build:web`.

## 67 — Surface hidden files and folders on demand

**Blocked by:** 64.

**Status:** Not started.

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

Evidence: focused protocol, adapter, listing projection, tree, Quick Open,
and menu tests; the workspace and library-files server suites;
`pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`.

## 68 — Import a public GitHub repository

**Blocked by:** 64.

**Status:** Not started.

J02 gains a URL-paste route from the Library switcher and the folder-add
menu. Canonical HTTPS owner and repository parsing, an auto-derived folder
name, a live destination preview under folder home, inline refusals for
submodules and Git LFS, and cancellation that cleans staging without touching
existing members.

The server owns cloning, isolated staging, atomic publication, registration,
and the background sync trigger. The renderer owns validation feedback and
the request lifecycle, and never learns a staging path.

Evidence: focused validation, protocol, adapter, hook, and modal tests; the
github-import server suite; J02 and Journey Coverage updates;
`pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`.

## 69 — Edit Agent Instructions per scope

**Blocked by:** 64.

**Status:** Not started.

Folder scopes and the Library scope each resolve a packaged default and an
optional saved customization under the configuration's agent-instructions
key. The editor and its presence indicator follow the active Chat's scope,
and one exported scope-key helper keeps the request parameter and the effect
identity from disagreeing. Runtime adapters inject the resolved text
verbatim; the renderer never holds a resolved prompt as durable state.

Evidence: focused protocol, scope-key, adapter, hook, and editor tests; the
agent-instructions server suite; story accessibility; `pnpm typecheck`,
`pnpm lint:web`, `pnpm build:web`.



## 72 — Build Wiki Pages from a folder

**Blocked by:** 64, 69.

**Status:** Not started.

Complete the J12 renderer responsibilities. Building a wiki is an ordinary
visible Agent request against the active folder, with Agent Instructions
carrying the durable contract and the resulting pages landing as ordinary
local source files. Progress, refusal, and recovery read through the existing
Agent surfaces rather than a private staged-intent machine.

Register J12 in the journey document and Journey Coverage in the same change.

Evidence: focused request, progress, and result tests; agent server suite;
J12 and Journey Coverage updates; a driven runtime pass through the real app
from folder to built pages; `pnpm typecheck`, `pnpm lint:web`,
`pnpm build:web`.

## 73 — Browse and copy from the Gallery

**Blocked by:** 68, 72.

**Status:** Not started.

Complete the J13 renderer responsibilities. A bare window derives the Gallery
band below its blank Chat composer, and a folder window reaches the same shop
as a near-fullscreen overlay from an entry in the existing replacement
sidebar. The entry
detail is a product-page dialog carrying the file tree, the producing request
as copy-only text, curated screenshots, and Make a copy, which reuses the
task 68 import into folder home and opens the result in a new window.

The index and screenshots travel only through the daemon's pinned-host proxy,
which suits the replacement's strict `app://` policy. Total index failure
answers with a success envelope carrying an unsupported schema, and the
client falls back to the bundled snapshot without console noise offline.

Register J13 in the journey document and Journey Coverage in the same change.

Evidence: focused proxy protocol, adapter, fallback, band, overlay, and
detail-dialog tests; the gallery server suite; story accessibility; J13 and
Journey Coverage updates; a driven runtime pass from the band through Make a
copy; `pnpm typecheck`, `pnpm lint:web`, `pnpm build:web`.


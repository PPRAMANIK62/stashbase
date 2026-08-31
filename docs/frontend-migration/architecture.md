# Target Frontend Architecture

Status: **Proposed**. This is the target for the replacement renderer.
[Renderer Architecture](../../code-review/renderer-architecture.md) describes
the Shipping renderer until cutover; approved replacement decisions govern new
code and update affected permanent contracts when they change an Interface or
invariant.

## Architectural Goals

- Make domain rules testable without React, DOM, HTTP, or Electron.
- Keep external effects behind narrow capability-oriented ports.
- Give each product area one public surface and private implementation.
- Separate server-owned state, durable preferences, and transient UI state.
- Make stale asynchronous work unable to mutate a newer scope.
- Keep heavy viewers, editors, and Agent surfaces outside initial JavaScript.
- Make cross-feature coordination visible at the composition root.

## Rewrite Boundary

The target is the complete frontend system, not only the React source tree. It
includes the renderer and the frontend-facing preload, Electron, shared-wire,
persistence, and server API Seams needed to give responsibilities coherent
owners. Backend domain capabilities remain outside the rewrite unless an
approved frontend boundary change requires coordinated work at their public
Interface.

No existing Interface is preserved solely to reduce migration work. Changing a
cross-process or persisted Interface requires an approved decision that names
compatibility, rollout, rollback, trust, and evidence consequences.

## Renderer Trust Boundary

Every replacement window runs with Chromium process sandboxing and context
isolation enabled, Node integration and webviews disabled, web security
enabled, and experimental features absent. A window that cannot satisfy these
defaults requires its own approved trust-boundary decision; the application
default is never relaxed.

Packaged renderer assets load from a privileged custom `app://` protocol.
Authenticated loopback HTTP and WebSocket remain server-capability transports,
not the UI asset origin. This lets the safe shell paint independently of server
settlement and supports a strict production Content Security Policy.
Development may use Vite through explicit development-only plumbing.

Production CSP starts at `default-src 'none'` and admits only the application
origin, exact authenticated loopback endpoints, packaged assets and fonts, and
narrowly required image or media schemes. Scripts are self-hosted without
`unsafe-eval`; remote scripts, remote styles, and arbitrary frames are denied.
Document previews use separate sandboxed origins and policies and cannot weaken
the shell.

A bundled sandbox-compatible TypeScript preload exposes one capability-specific
method at a time through `contextBridge`. It never exposes raw IPC, generic
channel methods, or Electron event objects. Shared Zod IPC schemas validate
arguments and results, subscriptions return explicit disposal functions, and
preload contains no product policy.

Main-process handlers additionally validate sender window, frame, origin,
capability, and payload. Sensitive work binds to main-owned stable window
identity rather than trusting an identity argument. Navigation and new-window
creation are denied by default; external URLs are allowlisted immediately
before opening, and sessions install explicit permission handlers.

## Module Shape

The replacement starts in a sibling `renderer/` tree during migration. Its
source follows this shape:

```text
src/
  app/
    bootstrap/
    composition/
    errors/
    workflows/
  platform/
    api/
    electron/
    persistence/
    scheduling/
  shared/
    domain/
    ui/
    styling/
    utilities/
  features/
    agent/
    documents/
    preparation/
    retrieval/
    settings/
    workspace/
```

Each feature may contain:

```text
feature/
  domain/          pure identities, policies, state, and transitions
  application/     commands, queries, workflows, and port definitions
  infrastructure/  feature-specific port adapters
  ui/              React views and view adapters
  public.ts         the complete external surface
```

Folders are earned by responsibility. A small feature does not need empty
layers or pass-through modules.

The initial feature boundaries are:

| Feature | Capability | Owning product area |
|---|---|---|
| `workspace` | active-folder scope, visible source membership, navigation | Workspace |
| `documents` | source and tab identity, loading, editing, save and conflict | Documents |
| `retrieval` | exact and semantic retrieval, result identity, navigation intent | Search and Retrieval |
| `preparation` | derived-state status and user controls | Preparation |
| `agent` | sessions, turns, permissions, and source context | Agent Panel |
| `settings` | durable preferences, credentials, account and runtime configuration | Workspace / Agent Panel |

An engineering feature may be narrower than a product area, but it must name
one independently meaningful capability and its owning area. Account behavior
starts within `settings`; it earns a separate feature only if it develops an
independent lifecycle and contract. Use `retrieval` for the shared capability;
Search is one surface that invokes it.

## Dependency Direction

```text
app composition ───────→ feature public surfaces
                              │
feature UI ─────────────→ application ───────────→ domain
                              │
                              ↓ ports
platform / infrastructure adapters

shared UI and pure utilities are leaves
```

Required rules:

- Domain code imports no React, DOM, network, Electron, storage, or feature UI.
- Application code depends on domain code and abstract ports, not concrete
  transport clients.
- UI invokes application commands and renders state; it does not sequence
  transport calls or encode domain recovery.
- A feature never imports another feature's internals or public surface.
- `app/` is the only owner of multi-feature composition.
- `platform/` translates external protocols and owns no product policy.
- Cross-process wire contracts continue to live under repository `shared/`;
  the renderer never imports `server/` implementation.

Automated boundary checks must enforce these rules before feature work grows.
CI blocks forbidden layer dependencies, feature deep imports, direct platform
access from UI, and external data entering application code without runtime
validation. Ordinary feature changes cannot waive these checks. A deviation
requires an approved architecture decision and corresponding rule change
before implementation.

Feature isolation is absolute. A feature does not call another feature even
when their product outcomes are closely related. `app/composition/` constructs
and connects public feature capabilities; `app/workflows/` owns named
cross-feature ordering and recovery. Shared product identities needed at those
boundaries live in a deliberately tiny `shared/domain/` identity kernel. It may
contain stable value types such as folder identity, source reference, source
version, and authorized scope. It contains no feature state, workflow, wire
payload, or convenience helper. Changes to this kernel require architecture
review; there is no generic `shared/types/` drawer.

## State Ownership

State is classified before choosing a storage mechanism.

| State class | Owner | Examples |
|---|---|---|
| Durable source truth | Server or local files | file bytes, versions, membership |
| Remote/server state | Query boundary | folder listing, index status, search results |
| Durable preference | Settings persistence | appearance, Agent choice, indexing source |
| Domain session state | Feature application layer | tabs, scope binding, save/conflict state |
| Ephemeral interaction | Nearest UI owner | open menu, hover, draft filter, focus return |

Do not create one global store containing every class. TanStack Query owns
cacheable server-state mechanics with documented keys, invalidation,
cancellation, freshness, and retry policy. Domain-session state uses pure
transitions implemented in scoped Zustand vanilla stores. Ephemeral state stays
local unless multiple independently mounted surfaces genuinely coordinate it.

Every folder-, tab-, document-, search-, or Agent-scoped asynchronous command
captures an identity and generation. Completion applies only if that identity
is still current. A library choice or state-management library does not remove
this invariant.

Each stateful feature exposes an explicitly constructed application runtime at
its real lifetime: window, active folder, document tab, Agent session, or
another named scope. The composition root creates and disposes it. The runtime
owns commands, observable domain-session state, generation guards,
cancellation, subscriptions, and cleanup; it is never an ambient singleton.
React may receive an existing runtime through Context and subscribe through
selectors, but Context is not the state owner. Feature code constructs Zustand
vanilla stores rather than module-global React-bound stores. Server-state query
caches are separate from these runtimes: listings, status, results, and runtime
catalogs may be queries, while tab state, save/conflict state, scope
generations, Agent sessions, and workflow state are not.

Store factories follow actual lifetimes. Bootstrap creates a window runtime;
opening a folder creates its Workspace runtime; independently disposable open
documents and Agent sessions receive their own runtimes. A runtime may retain a
keyed collection only when its members genuinely share lifecycle and
transaction rules. Ending a scope disposes its runtime and cancellation
resources rather than manually resetting fields in a permanent global store.

Zustand persistence middleware is not a durability mechanism. Each approved
session concept uses a versioned persistence adapter and explicit restore
policy. Persisted session data is limited to approved identities and
presentation state such as active folder, recent tabs, pane sizes, and safe
view preferences. Query caches, pending commands, failures, credentials,
authorization, and unsaved source content are excluded.

Renderer windows never synchronize stores directly. Each owns independent
runtimes and reconciles versioned server state or main-process lifecycle events
through its normal commands and queries. Durable owners remain the coherence
authority; there is no renderer replication bus or hidden global Electron
store.

Bootstrap creates one TanStack `QueryClient` per renderer window. Features own
typed query-key factories and query definitions; composition provides the
client. Folder loss, folder removal, and authorization changes cancel and
remove affected scoped queries. Ordinary navigation may retain bounded data
according to its declared freshness policy. Query results are not copied into
Zustand for convenience.

## Ports and Adapters

External access is expressed through capability-oriented ports rather than a
generic client imported throughout the tree:

```ts
interface WorkspaceGateway {
  openFolder(path: string, signal: AbortSignal): Promise<WorkspaceSnapshot>;
}

interface DocumentGateway {
  load(ref: DocumentRef, signal: AbortSignal): Promise<DocumentSource>;
  save(command: SaveDocumentCommand): Promise<SaveResult>;
}
```

Responses crossing HTTP, Electron IPC, persistence, worker, or untrusted
document boundaries receive runtime validation before becoming application
values. Errors are classified by recovery behavior—retryable, stale version,
unauthorized, unavailable, invalid response, or fatal—not flattened into
strings at the transport boundary.

The consuming feature's application layer owns each port. Reusable HTTP, IPC,
persistence, worker, and scheduling mechanisms live in `platform/`; composition
injects them into feature-specific adapters. Platform transports do not expose
product endpoints for UI code to call directly.

Repository-owned wire protocols are defined by shared executable Zod schemas
from which their TypeScript wire types are inferred. Producers and
adapters share those schemas, then adapters map validated wire values into
feature-owned application or domain values. Third-party inputs use schemas at
the adapter that owns that trust boundary. A TypeScript assertion is never a
substitute for boundary validation.

Repository-owned schemas live under repository `shared/protocols/`, grouped by
HTTP, Electron IPC, WebSocket, worker, and persisted protocol. Breaking changes
require an explicit compatibility decision. Additive changes are compatible
only when schemas and consumers deliberately tolerate them.

Every operation defines request, success, and classified-failure schemas.
Contract tests parse representative producer output and prove adapter mapping,
including backward/forward fixtures for each compatibility claim. Version a
specific boundary only when parallel representations are genuinely required;
do not introduce one global API version pre-emptively.

## Navigation and Failures

Features emit typed navigation intents; app composition resolves them. A
persistable or externally addressable location may have a serializable route,
but a router does not own tabs, active-folder scope, overlays, or workflow
state. Add a routing library only when a concrete deep-link or browser-history
requirement justifies it.

Cross-feature application boundaries use a small shared failure classification:
unauthorized, unavailable, invalid response, conflict, cancelled, and fatal.
Feature-private errors may be richer but map to this vocabulary at their public
surface. Failures retain their cause and safe recovery context; they are not
flattened into display strings or forced into one universal exception class.

Unexpected view failures are contained at four levels: bootstrap retains a
native-safe fatal path; the app-shell boundary preserves window controls;
feature boundaries isolate capability failures; and lazy-surface boundaries
offer local retry. A rendering failure does not dispose a scoped runtime,
unsaved buffer, or unaffected feature unless the runtime itself is proven
corrupt. Recovery remounts the narrowest failed view.

A single window-scoped connection-health owner coordinates bounded jittered
reconnect to the Electron-owned server. Disconnection keeps the shell, tabs,
safe cached data, and unsaved buffers mounted. Features expose localized stale
or unavailable state. Only explicitly safe, idempotent mutations may queue;
other user intent remains recoverable for an explicit retry. Server loss never
causes an automatic renderer reload.

Durable crash recovery for unsaved documents is approved Direction, not
Shipping behavior. Its separately reviewed design must protect recovery
snapshots with encryption or OS-user protection, key them by source identity
and expected version, write off the interaction path, remove them after a
confirmed save, and offer explicit restore or discard after an unclean exit.
It never silently overwrites source content. Until protection and key ownership
are approved, the absence of durable recovery remains a named gap.

The server-side File Transactions module owns the recovery journal's format,
source-version binding, retention, encryption, crash consistency, and cleanup.
The renderer submits bounded snapshots through a dedicated application port;
Electron may expose OS-backed key protection but owns no document semantics.
Recovery state remains private derived data outside visible workspaces.
Implementation stays blocked until key availability, logout behavior, backup
interaction, and multi-window ownership are explicitly approved.

## Architecture Enforcement

Architecture is enforced by complementary CI gates:

- Dependency-cruiser checks layer direction, cycles, sibling-feature imports,
  and public-entry-only feature access.
- Oxlint rejects layer-specific APIs and imports, including React or DOM in
  domain code and direct transport access from UI.
- A focused repository checker enforces project-specific declarations such as
  feature ownership and registration of repository-owned wire schemas.

These gates are active from the replacement foundation. The committed renderer
architecture declaration records the approved feature owners and registered
repository wire modules; adding a directory or importing a shared protocol
without updating that reviewed declaration fails before feature tests run.

Tests follow production boundaries. A test may cross one only through a named,
narrow test entry point; blanket architecture-rule exemptions for test folders
are forbidden. Suppressions and compatibility layers cannot bypass these gates.

## Feature Communication

Use one of three mechanisms:

- App composition passes data or callbacks between public feature surfaces.
- An application command coordinates a workflow spanning stable feature
  capabilities.
- A feature-agnostic event carries a notification with no hidden sequencing.

Events do not replace commands, return values, or owned state. A workflow that
requires ordering, authorization, rollback, or recovery has an explicit
application owner.

## Rendering and Performance

- Keep the application shell and lightweight gates eager.
- Put heavy viewers, editors, menus, settings, and Agent bodies behind
  feature-owned lazy boundaries.
- Define loading, error, retry, and focus restoration at each boundary.
- Measure the generated manifest and initial JavaScript budget in CI.
- Virtualize only measured large collections; preserve keyboard navigation
  and accessibility semantics when doing so.
- Avoid pre-emptive memoization. Stabilize public state selectors and context
  values, then optimize measured hot paths.

Components subscribe to the smallest stable Zustand selector or TanStack Query
projection that satisfies the view; they do not consume whole feature stores or
query result objects for convenience. Feature-owned selectors memoize expensive
derived collections. React transitions and deferred values apply only to
nonurgent work whose interruption preserves correctness. `React.memo` follows
measurement rather than compensating for broad subscriptions.

Suspense owns lazy code boundaries, not routine server data. Queries preserve
safe prior data and expose local pending and failure state. A data-Suspense
boundary requires a surface whose entire existence depends on that one result
and must still define recovery and focus behavior.

Virtualize only measured or contractually unbounded collections, expected to
include large file trees, search results, and transcripts rather than tabs or
ordinary short lists. The virtual surface consumes the same canonical visible-
item model as keyboard navigation, preserves stable identity and semantic
position/count, and keeps focus valid when rows leave the viewport.

Startup is staged. Window identity, native-aligned chrome, theme, and the
minimum safe shell produce the first frame. Folder restoration, server health,
settings hydration, Agent discovery, indexing status, and update checks settle
concurrently behind capability-local loading and recovery; they do not form a
serial bootstrap chain or one global readiness gate.

Before React mounts, a tiny trusted bootstrap applies system/light/dark theme,
interface scale, density, contrast, and reduced-motion mappings from a
synchronously available non-secret appearance snapshot. Settings remains the
durable authority and reconciles after mount. The snapshot contains no
credentials or unrelated preferences and does not wait for the server.

Process work follows ownership and responsiveness:

- Electron main performs native and window orchestration, never parsing or bulk
  I/O.
- The renderer main thread performs interaction and bounded view-model work.
- Web Workers own renderer-specific parsing, transformation, filtering, or
  syntax work that can exceed one frame.
- The Node server and sidecars own filesystem traversal, conversion, indexing,
  search, and durable operations.

Work that can exceed one renderer frame yields, chunks, or moves off the main
thread. Long operations expose cancellation and meaningful progress. IPC is
reserved for native capabilities and lifecycle; server domain capabilities
continue through local HTTP or WebSocket boundaries. Both paths propagate
cancellation and request identity, batch chatty metadata, stream progressive or
large results with backpressure, and avoid repeated serialization of large
binary payloads. Synchronous IPC and renderer filesystem access are forbidden.

Routine loading preserves continuity: safe stale content remains while it
revalidates, pending state stays near its initiating surface, indeterminate
feedback is delayed enough to avoid flashes, and skeletons are reserved for
initial structure. A feature request does not blank the workspace. Lazy and
recovery boundaries preserve layout and restore focus.

Optimistic updates are limited to reversible, low-risk metadata with rollback
or authoritative reconciliation. Saves, moves, deletes, permission grants,
credential changes, folder removal, and Agent tool actions await authority
while immediately preserving input, showing pending state, and leaving
unrelated interaction available.

Phase 0 establishes reproducible CI baselines and approved budgets for initial
JavaScript, first shell paint, usable interaction, warm folder restoration,
large-folder navigation, document switching, search first result, renderer
long tasks or dropped frames, and memory after repeated scope disposal. The
Shipping `437 KiB` initial-static-JavaScript budget remains a ceiling until a
stricter replacement budget is approved; a regression cannot be hidden by
raising a threshold.

Heavy resources use explicit bounded ownership. Parsed documents, editor
models, preview data, object URLs, document handles, and workers are keyed by
source identity and version, created lazily, and disposed with their runtime.
Lightweight recent-tab state may survive temporary hiding; heavy caches declare
size or count limits, suspend hidden work, and never reuse content after a
source-version change.

The foundation defines restrained semantic motion for feedback, overlays, and
spatial transitions. Motion uses compositor-friendly properties, remains
interruptible, never delays a state transition, and honors reduced motion at
the primitive. Immediate acknowledgment has priority over decoration.

Named performance marks cover bootstrap stages and major user intents.
Development and CI observe long tasks, dropped frames, resource counts, and
disposal. Measurements contain capability names, durations, sizes, and
anonymous fixture characteristics—not paths, filenames, queries, prompts,
document contents, credentials, or transcript text. Production telemetry is
absent unless separately designed and approved.

## Styling

Fluid Functionalism is the complete visual and component system. Its global
CSS owns semantic colors, the eight-level substrate/shadow ladder, Inter
Variable typography, focus, type roles, scrollbar treatment, and component
utilities. Its React providers own shape, size, icon, substrate, tooltip, and
reduced-motion behavior. The replacement does not create a parallel StashBase
token hierarchy or primitive library.

Components are installed as reviewed source through the configured `@fluid`
shadcn registry. The CLI is transport only; stock shadcn components are not an
application dependency. Every dual-flavor Fluid component uses Base UI.
Features compose Fluid components and never import Base UI directly. Native
semantic elements remain appropriate for noninteractive structure.

Registry source may be adapted only at a host boundary that Fluid does not
own, such as replacing Next.js Link with a native anchor or bundling a worker
under the Electron content-security policy. Such changes preserve the public
component contract and are recorded with the installed source snapshot.

There is no separate design-system workbench or story-only styling layer.
Focused component tests, product runtime harnesses, and final migration visual
evidence exercise the same source and providers as the renderer.

The replacement targets WCAG 2.2 AA, including keyboard-only operation,
visible focus, programmatic names/roles/states, focus return, screen-reader
announcements, 200% interface scaling, forced colors, reduced motion, and
non-color status cues. Automated accessibility checks are a floor; focused
interaction and Electron journeys own keyboard and focus evidence.

The Continuous Workbench product composition remains approved, while Fluid
Functionalism owns its visual expression. Legacy `web-src` styling is not an
input. Fluid's bundled Inter face, shape and density providers, surface ladder,
focus color, semantic status colors, and springs are adopted without a second
StashBase visual layer.

Workspace, Workbench, Agent Panel, and overlay composition respond primarily to
their container rather than viewport breakpoints. Tokens define compact and
default density plus minimum interaction geometry. Adaptation may reprioritize
or regroup controls but cannot silently remove essential actions.

React Hook Form plus Zod resolvers owns mechanics and field validation for
multi-field forms. Small one-field interactions stay controlled when a form
abstraction adds no value. Application commands continue to own settings
policy, authorization, ordering, and persistence; form state is never durable
application state.

App composition mounts exactly one root Sonner `Toaster`, outside overlay
stacking contexts and bound to the resolved theme. A narrow notification
capability maps semantic completion or nonblocking events to stable IDs and
durations; features never import Sonner or compose arbitrary toast policy.
Because the component system is Tailwind-owned, notifications use Sonner's
headless custom rendering with the repository shadcn/Tailwind notification
shell while retaining Sonner positioning, stacking, update, dismissal, and
swipe mechanics. Inline recovery, decisions, persistent degradation, and
fatal failure remain with their owning surfaces rather than becoming toasts.

App composition owns a typed command registry for keyboard, menu, and visible
control invocation. Features publish commands with stable identity, accessible
label, availability, and execution; composition resolves conflicts and native
bindings. Editors retain standard text-editing commands. No scattered document
listener or string event may bypass the same save, permission, and workflow
path used by visible controls.

The foundation must prove themes, interface scaling, reduced motion, native
titlebar geometry, overlay layering, and Linux visual baselines.

## Technology Decisions

React and TypeScript remain the application foundation. Vite+ is the pinned
replacement toolchain and unified entry for Vite/Rolldown builds, Vitest,
Oxlint, formatting, and task orchestration. Its aliases are repository-level
package-resolution policy, but its frontend tasks apply only to `renderer`.
pnpm remains the underlying lockfile-backed package manager.

Choose supporting libraries only after the relevant ownership model is
defined. In particular, a query library may implement server-state mechanics
but does not own domain transitions; a form library may implement interaction
mechanics but does not own settings policy.

`renderer/` is an independent workspace package that owns Vite+, strict
TypeScript, Vitest, Tailwind, entry, and architecture configuration.
Stable frontend commands validate and build it from the initial scaffold. No
runtime or user setting selects between renderers, and `web-src/` is inert
reference material outside supported commands and evidence. The replacement
shares only intentional repository protocols and assets, not legacy aliases,
source, CSS, configuration, or tool tasks.

Dependencies are exact and lockfile-pinned, justified by an owned
responsibility, and reviewed for bundle and privilege effects. Installed Fluid
components become reviewed first-party source and are never updated blindly.
Runtime CDN assets, registry access, and remote code are forbidden.

The exact local Vite+ package, its bundled tool versions, the pnpm lockfile,
and committed Vite-core and Vitest resolution aliases are the toolchain
authority; no developer or CI result may depend on an unpinned global `vp`.
Upgrades are focused changes that record the resolved Vite, Vitest, Rolldown,
Oxlint, formatter, task-runner, and engine versions and rerun the complete
affected matrix. Beta status is accepted deliberately and does not justify
floating versions or bypassing repository-specific checks.

Vite+ adoption pins the repository tool inventory and then starts with the
isolated `renderer` package. Oxfmt applies to replacement files from their
creation; no repository-wide baseline reformats legacy, generated, vendored,
fixture, snapshot, or intentionally literal files. Stable frontend commands
target `renderer` immediately; direct `vp` remains available for focused
diagnosis.

Vite+ task-result caching is disabled repository-wide. CI may reuse pnpm's
content-addressed dependency store, but Electron smoke, E2E, visual,
native/runtime, packaging, signing, release, credentialed, and undeclared-side-
effect tasks never restore task outputs.

The exact local package is authoritative. The committed expected-toolchain
record preserves the complete reported graph except for the machine-specific
local package path. CI pins the official setup Action by commit SHA, requests
the chosen version without delegating Node or dependency installation, and
runs the same local inventory comparison. Mutable
installers and `latest` are forbidden in CI. The final PR leaves no production
Vite/Vite+ or renderer selector; rollback is version-control or release
reversion of the complete migration.

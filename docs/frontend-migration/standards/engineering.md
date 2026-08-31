# Engineering Standards

These standards apply to new migration code. They complement, and cannot
silently weaken, approved product or trust requirements. When they replace a
current engineering Interface or invariant, the decision and affected owning
contract must be approved and updated before implementation.

These standards are mandatory. CI enforces every rule that can be checked
mechanically. An ordinary feature change cannot add an exception, suppression,
or compatibility layer that bypasses them; changing a rule requires an
approved architecture decision first.

## Modules and Interfaces

- Each module has one reason to change and a deliberately small public API.
- Repository automation keeps stable pnpm command names as its Interface and
  groups migration-owned implementations under `scripts/<owner>/`; quoted
  directory-owned test globs replace repeated file inventories.
- Imports use `./` within one directory and `@/` across renderer directories;
  parent-relative `../` imports are forbidden. `@/protocols/*` is the explicit
  alias for registered repository-owned wire schemas.
- Each feature exposes only `public.ts`; consumers do not deep-import.
- Features never import another feature; cross-feature workflows and wiring
  belong to the app layer.
- Each feature declares its independently meaningful capability and owning
  product area; directory creation is not a substitute for ownership.
- Public types describe product concepts, not component implementation.
- Cross-feature identities live only in the reviewed `shared/domain/` kernel;
  generic shared type collections are forbidden.
- Prefer functions and value types over mutable service objects.
- Promote code to `shared/` only after independent consumers exist.
- Do not create generic repositories, managers, services, or event buses in
  anticipation of future use.
- Do not copy a legacy module into the replacement as a migration shortcut;
  reused behavior must be reimplemented behind the target owner and Interface.
- Construct stateful feature runtimes explicitly at a named lifetime and
  dispose them at that lifetime's end; ambient mutable singletons are forbidden.
- Implement domain-session runtimes with Zustand vanilla stores and pure
  transitions. Do not export module-global stores or bind ownership to React.
- Runtime factories follow window, folder, document, and Agent-session
  lifetimes. Disposal cancels owned work and subscriptions.
- Do not persist Zustand stores wholesale. Versioned adapters persist only
  approved identities and presentation state under an explicit restore policy.
- Windows reconcile through durable server state and main lifecycle events;
  direct renderer-store replication and hidden Electron global stores are
  forbidden.

## Domain and Application Logic

- Domain transitions are pure and deterministic.
- Invalid states are prevented by types where practical and rejected at one
  named boundary otherwise.
- Commands express user intent; queries read state without causing hidden
  writes.
- Workflows own ordering, authorization, compensation, and recovery.
- Time, IDs, scheduling, filesystem access, and network access enter through
  narrow ports when deterministic testing requires control.
- The consuming application layer owns a port; platform mechanisms and
  feature-specific adapters implement it, and composition performs injection.

## React

- Components render and capture interaction; hooks adapt application state to
  React lifecycle.
- Effects synchronize with an external system. Do not use an effect to derive
  state that can be calculated during render or in a domain transition.
- Async effects support cancellation and stale-completion guards.
- Context is split by update frequency and responsibility. Provider values
  are stable.
- Keep ephemeral state close to its surface. Promote it only for real
  coordination.
- Preserve accessible names, roles, focus order, focus return, and keyboard
  operation as part of the component Interface.
- Subscribe to the smallest stable Zustand selector or TanStack Query
  projection; whole-store and convenience whole-result subscriptions are
  forbidden.
- Use transitions or deferred values only for interruptible nonurgent work.
  Memoization follows measurement rather than masking broad ownership.
- Use Suspense for lazy code. Routine data loading preserves safe content and
  renders local pending, error, retry, and focus behavior.
- Contain failures at bootstrap, shell, feature, and lazy-surface boundaries;
  remount the narrowest view without discarding a healthy scoped runtime.
- Multi-field forms use React Hook Form with Zod resolvers for mechanics only;
  commands retain policy and persistence. Keep trivial one-field controls
  controlled.

## Data Access

- Components do not import HTTP, Electron, storage, or worker clients.
- Repository-owned wire payloads use shared runtime schemas with inferred wire
  types; standardize those schemas on Zod and map validated payloads into
  feature-owned values.
- TanStack Query owns only cacheable server state. Every query declares its
  complete scoped key, cancellation, freshness, retry, and invalidation policy.
- Use one QueryClient per renderer window. Scope loss or authorization change
  cancels and removes affected queries; do not mirror query data into Zustand.
- One adapter owns serialization and response validation for each external
  protocol.
- Cache keys include every scope that changes the answer.
- Mutations name their invalidation and optimistic-update policy.
- Optimistic writes have rollback or authoritative reconciliation.
- Credentials are configured through Settings and never read from renderer
  environment variables.
- Logs and surfaced errors exclude credentials and private document content.

## Electron Boundary

- Every application renderer enables sandboxing, context isolation, and web
  security and disables Node integration, webviews, and experimental features.
- Preload exposes capability-specific typed methods only. Raw IPC, generic
  channels, Electron event objects, and product policy are forbidden.
- IPC validates Zod payloads plus sender window, frame, origin, and capability;
  main-owned identity authorizes sensitive work.
- Navigation, new windows, permissions, and external URLs are denied by default
  and narrowly allowlisted at the owning main-process boundary.
- Packaged UI uses the custom application origin and a restrictive CSP;
  document-preview policies cannot widen the shell policy.

## Files and Documents

- Source identity is explicit and is never inferred from a display label.
- Folder-relative and out-of-folder identities remain distinct.
- Saves carry the expected source version and preserve conflict recovery.
- Hidden derived notes never appear as ordinary workspace files.
- Format capability comes from the canonical Documents matrix; preview,
  editing, preparation, retrieval, and mutation are separate claims.
- Untrusted document content does not gain application privileges.

## Types and Errors

- Avoid `any`; validate `unknown` at trust boundaries.
- Do not use type assertions to erase a protocol or state mismatch.
- Exhaustively handle discriminated unions.
- Preserve the original cause when translating errors.
- User-facing errors state what failed, what remains safe, and what recovery is
  available without exposing implementation or secrets.
- Public feature failures map to the shared recovery classification while
  retaining their original cause and safe context.

## Navigation

- Features emit typed navigation intents and app composition resolves them.
- A router does not own document tabs, folder scope, overlays, or workflow
  state; adopt one only for demonstrated deep-link or history requirements.
- App composition owns typed keyboard/menu commands. Shortcuts and visible
  controls invoke the same save, permission, and workflow paths.

## Styling and Components

- Use Fluid Functionalism as the complete visual and component system. Do not
  recreate its tokens, primitives, component anatomy, or motion in a local
  StashBase layer.
- Install Fluid source through the configured `@fluid` shadcn registry. Use the
  Base UI flavor for every dual-flavor component; stock shadcn and Radix UI
  components are forbidden.
- Features compose Fluid components and do not import Base UI directly.
  Noninteractive structure uses native semantic elements.
- Keep Fluid's global CSS, Inter Variable font, providers, springs, surface
  ladder, shape, size, focus, and icon contracts intact. A host adaptation must
  be narrow, required by the Vite/Electron boundary, and documented.
- Feature classes may control external layout. Visual anatomy remains owned by
  the installed Fluid component unless a demonstrated product requirement
  justifies an upstream-compatible extension.
- Do not add a second token file, primitive directory, or story-only
  stylesheet. Storybook may catalog installed Fluid components only when it
  mounts production CSS and providers and adds no alternate visual system.
- Colocated Milkdown overrides are the sole component-specific CSS exception;
  they target third-party editor internals and consume semantic tokens.
- Prove reusable, stateful, accessibility-sensitive, or visually risky
  components through focused production-backed tests and runtime harnesses.
- Prefer container queries for panes and overlays. Density tokens preserve
  minimum interaction geometry and essential actions at every supported size.
- Meet WCAG 2.2 AA across keyboard, focus, semantics, announcements, 200%
  scaling, forced colors, reduced motion, and non-color cues.
- Mount one root Sonner Toaster with resolved theme. Features call a semantic
  notification capability, never Sonner directly; custom headless rendering
  uses the repository Tailwind/shadcn notification shell.

## Performance and Loading

- Lazy boundaries belong to the feature that owns the heavy surface.
- Initial-load additions require manifest evidence.
- Produce the first safe shell before noncritical capability settlement; do not
  serialize independent bootstrap requests behind one readiness gate.
- Rendering optimizations require a measured problem or a known boundedness
  risk.
- Large directory and transcript work yields or moves off the critical UI path.
- Electron main performs no parsing or bulk I/O. Renderer work that can exceed
  one frame yields, chunks, or moves to a Web Worker; filesystem, conversion,
  indexing, search, and durable work remain server- or sidecar-owned.
- Synchronous IPC and renderer filesystem access are forbidden. Large or
  progressive transfers use batching or streaming with cancellation and
  backpressure rather than repeated full-payload serialization.
- A background operation must not block ordinary folder navigation or file
  reading unless the product contract requires it.
- Preserve safe stale content during refresh, keep feedback local, avoid
  flashing spinners, preserve layout, and restore focus across lazy recovery.
- Optimistically update only reversible low-risk metadata with rollback or
  reconciliation. Authoritative or destructive work preserves input and shows
  pending state without pretending completion.
- Every slice stays within approved startup, interaction, long-task, bundle,
  and disposal-memory budgets relevant to the capability.
- Virtualize only measured or unbounded collections, using the same visible
  model as keyboard navigation and preserving semantic position and focus.
- Heavy resource caches are bounded and version-keyed. Runtimes dispose
  workers, handles, subscriptions, and object URLs and suspend hidden work.
- Motion uses semantic tokens and compositor-friendly properties, remains
  interruptible, and honors reduced motion without delaying state changes.
- Performance diagnostics exclude paths, names, user text, document content,
  credentials, and transcripts. Production telemetry requires separate
  approval.
- Local-server disconnect keeps healthy views and buffers mounted. One
  connection owner coordinates bounded reconnect; only approved idempotent
  mutations may queue.

## Completion Rule

A migration change is incomplete when it adds code without focused evidence,
changes observable behavior without updating the owning journey/area, changes
an Interface or invariant without updating its review contract, or leaves the
capability ledger inaccurate.

Dependency-cruiser, Oxlint, and the repository architecture checker are
required CI gates. Tests receive no blanket boundary exemptions; intentional
test access uses a narrow named entry point. Styling scans reject raw visual
literals, arbitrary visual utilities, inline styles, and undeclared tokens.

`renderer` does not inherit legacy source, aliases, CSS, or configuration.
Dependencies are exact, responsibility-owned, and bundle/privilege reviewed;
runtime CDN assets, registry fetches, and remote code are forbidden.

Vite+ is the pinned replacement toolchain. pnpm remains the lockfile-backed
package manager; committed aliases keep Vite core and Vitest resolution aligned
with the selected Vite+ release, while the expected inventory records its
bundled and compiled tools. Repository-specific
architecture, docs, Electron, E2E, packaging, and release gates remain explicit
tasks rather than disappearing behind a generic toolchain check.

- Stable frontend scripts prove only the isolated replacement from its initial
  scaffold; no supported command builds or validates `web-src`.
- Oxfmt applies to `renderer` from creation and does not reformat legacy or
  unrelated repository files.
- Vite+ task-result caching is disabled repository-wide. CI may reuse pnpm's
  content-addressed dependency store, but native, E2E, visual, packaging,
  signing, release, credentialed, and side-effecting tasks never restore task
  outputs.
- CI pins the Vite+ setup Action by commit, requests the exact version without
  taking over Node or dependency installation, and verifies the resolved tool
  inventory.
- Vite+ is the sole accepted toolchain after its focused migration; rollback is
  version-control reversion, not permanent dual tooling.

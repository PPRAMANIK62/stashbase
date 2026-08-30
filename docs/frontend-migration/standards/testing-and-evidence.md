# Testing and Evidence

The migration proves approved behavior and architecture; it does not infer
correctness from legacy parity, a successful build, or a visually similar
screen.

## Evidence Layers

| Layer | Proves |
|---|---|
| Domain test | pure state transitions, identities, policies, recovery plans |
| Application test | command ordering, cancellation, stale-result rejection, port use |
| Adapter contract test | serialization, runtime validation, error translation |
| Rendered component test | semantics, interaction, focus, observable state |
| Journey E2E | decisive product Seams compose into the required outcome |
| Visual test | representative layout, theme, density, and overlay composition |
| Release check | packaged, native, credentialed, or platform-owned behavior |

The replacement uses Vitest for domain, application, adapter, and component
tests; React Testing Library plus `user-event` for semantic interaction; MSW at
HTTP boundaries; and axe for automated accessibility checks. Application tests
prefer port fakes over transport mocks. Component tests construct real scoped
Zustand runtimes and isolated QueryClients. Playwright Electron journeys remain
the authority for real cross-process behavior.

Storybook owns discoverable primitive and component states and uses the
production provider and token stack. Playwright exercises its stories for
visual composition and focused interaction without treating a story render as
journey evidence.

Story evidence covers meaningful default, focus, disabled, loading, empty,
error, long-content, narrow-window, theme, interface-scale, and reduced-motion
states as applicable. Source gates prove Base UI access stays inside the
primitive layer and reject raw visual literals, arbitrary visual utilities,
inline styles, and undeclared tokens.

Accessibility evidence combines axe with semantic queries, keyboard-only
interaction, focus order and return, announcements, forced colors, reduced
motion, and 200% interface scale. Notification evidence proves one Toaster,
theme alignment, stable-ID update rather than duplication, correct dismissal,
overlay stacking, and that actionable recovery remains outside transient toast.

Performance evidence uses a fixed environment and records distributions or
bounded traces rather than one favorable sample. It covers both objective
latency and the observable continuity contract: unrelated interaction remains
available, stale-safe content does not blank, pending state is local, and
cancelled or disposed work does not reappear or retain resources.

Focused performance tests cover selector isolation, interrupted nonurgent work,
safe-content retention during refresh, virtualized keyboard/focus behavior,
source-version cache invalidation, and repeated creation/disposal of workers,
handles, subscriptions, and object URLs. Reduced-motion evidence verifies the
primitive contract rather than checking every animation independently.

Failure evidence proves boundary isolation, narrow remount, retained unsaved
buffers, and local-server reconnection without renderer reload. Crash-recovery
evidence is required only when its separately approved protection and storage
design is implemented; until then the product Known Gap remains explicit.

Electron boundary tests assert effective BrowserWindow preferences, custom-
protocol privilege, production CSP, navigation and window denial, permission
handling, external-URL validation, preload surface shape, payload rejection,
sender/frame/origin rejection, subscription cleanup, and main-owned identity.
Run these through a real sandboxed Electron smoke path in addition to unit
tests of handler policy.

Every repository-owned protocol operation has request, success, and
classified-failure schema tests against representative producer output and
adapter mapping. Compatibility claims include pinned backward/forward fixtures;
schema acceptance alone is insufficient when mapping semantics changed.

Tests assert observable output or a named Interface. They do not inspect
component source text. Source scans remain appropriate for repository-wide
dependency, token, literal, and boundary rules.

## Behavioral Discovery and Contract Method

For each journey slice:

1. Read every Required Observable Result and recovery path in the journey.
2. Locate its owning contracts through Journey Coverage.
3. Identify the current evidence and inspect what it actually asserts.
4. Classify discovered behavior as retained, intentionally changed, or
   unresolved; obtain approval for changed behavior and boundary decisions.
5. Add missing black-box evidence before replacing retained behavior when the
   old implementation is the only specification.
6. Prove the approved contract against the replacement, adapting evidence when
   an intentional behavior or Interface change makes a legacy assertion stale.
7. Record remaining gaps honestly in the capability ledger and owning docs.

Do not copy implementation-coupled tests merely to preserve internals. Keep or
rewrite the assertion at the lowest stable Interface that proves the contract.
Matching legacy behavior is neither necessary nor sufficient when an approved
replacement contract differs.

## Migration Test Harness

The renderer test harness and stable E2E/build path target `web-next` directly;
there is no renderer selector and product tests do not fork between
implementations. `web-src` tests are reference material outside the supported
test inventory.

Fixtures remain deterministic and disposable. Electron launches remove an
inherited `ELECTRON_RUN_AS_NODE`. Worktrees exercising indexing or sync provide
`python/.venv.nosync`; a missing `mfs` module is environment failure.

Replacement CI records and checks the pinned Vite+ resolved-tool inventory and
runs the isolated format, lint, test, typecheck, build, and boundary gates.
Cache is disabled for Electron, E2E, visual, native/runtime, packaging,
signing, release, credentialed, and side-effecting evidence.

## Slice Gate

Every slice runs:

```bash
pnpm typecheck
pnpm format:web
pnpm lint:web
pnpm test:renderer
pnpm build:web
```

It also runs focused commands from every crossed review contract and the
specific renderer/component/E2E tests named in the capability ledger.
Documentation changes run:

```bash
pnpm test:docs
```

E2E changes additionally run `pnpm test:e2e:check-focus`. Promote only
release-blocking cross-feature paths to smoke; broader behavior belongs in
functional journeys.

## Cutover Gate

Before the new renderer becomes the production entry, run the complete matrix
required by the repository, including:

```bash
pnpm test:renderer
pnpm test:renderer-quality-gates
pnpm typecheck
pnpm lint:web
pnpm build:web
pnpm test:docs
pnpm test:e2e:check-focus
env -u ELECTRON_RUN_AS_NODE pnpm test:electron:smoke
env -u ELECTRON_RUN_AS_NODE pnpm test:e2e:smoke
env -u ELECTRON_RUN_AS_NODE pnpm test:e2e:functional
```

Run `pnpm test:e2e:visual` on Linux for covered composition changes. Generate
intentional baselines through the repository workflow; do not approve local
macOS or Windows goldens.

Record initial JavaScript, required dynamic entries, production build output,
startup stages, representative interaction measurements, renderer long tasks,
and memory after repeated scope disposal. A regression needs explicit
maintainer acceptance, not a raised budget hidden inside cutover.

# Renderer Architecture

The renderer's owning engineering contract: the layer model, the vocabulary a
reviewer is expected to recognize, the state ownership rules, and every rule a
machine enforces. Styling mechanics live in
[Renderer Styling](renderer-styling.md). Workspace state transitions live in
[Renderer Workspace](renderer-workspace.md). Journey evidence lives in
[Journey Coverage](journey-coverage.md).

## Scope and Ownership

This contract covers everything under `renderer/src` plus the tooling that
polices it. It governs where a module may live, what it may import, how large
it may grow, and what evidence proves it. It does not restate product intent,
which stays in `design-docs/`.

The renderer is one Vite application composed by `app`. Everything else is a
layer with a single reason to exist, and the direction of dependency is the
whole design: outer layers know inner ones, never the reverse.

The frontend is a complete reimplementation rather than a port. Product
outcomes and trust requirements were the constraints the rebuild had to meet;
the previous module graph, state model, and allocation of responsibilities were
not, and its patterns carry no authority here.

The renderer it replaced is deleted. Its behavior lives in this contract set,
in `design-docs/`, and in version-control history, which is where a question
about what the product used to do belongs. Nothing in the repository builds,
imports, tests, or packages a second frontend, and `renderer/` is the only
one.

## Layer Model

- **`app`** composes. It owns providers, dependency wiring, workflows that span
  features, and shell composition. It is the only layer allowed to import a
  feature's `public.ts`.
- **`features/<name>`** is a product capability, isolated from its siblings.
  Each feature is exactly these entries:
  - `domain` — pure values, state transitions, identities, and recovery plans.
    No React, no DOM, no Node, no transport.
  - `application` — Ports, Runtimes, and command orchestration expressed
    against those Ports. It selects no adapter and renders nothing.
  - `infrastructure` — Adapters that implement the Ports: transport calls, wire
    validation, and the mapping from wire types to feature types.
  - `hooks` — React adaptation of application capabilities into view models.
  - `ui` — views, which invoke capabilities and never reach a transport.
  - `public.ts` — the only entry other code may import.
  - `test-support.ts` — optional, and the one exception to `public.ts`: it
    builds the feature's real runtime over fakes so a suite does not rebuild
    the wiring. Only a `*.test.*` file may import it.
- **`lib`** is the installed Fluid registry exactly as the installer emits it:
  token contexts, geometry and motion primitives, and the hooks
  `components/ui` and `components/internal` are built out of. A registry test
  keeps the `lib` root equal to the manifest, so nothing local lands where a
  reinstall would overwrite it. Local kit extensions that only components
  consume live under `lib/local`. The dependency runs one way: `lib` and
  `components` may reach `shared/utils` and nothing else under `shared`, which
  is what keeps the kit installable without the application.
- **`shared`** is a leaf. It holds `shared/domain` and `shared/utils`, both
  pure; `shared/runtime`, the application plumbing (request-signal lifetimes,
  lazily mounted surfaces, command-surface registration, runtime scoping and
  retention, scroll anchoring, text-entry focus, and the provider stack the
  application mounts); `shared/ui` and `shared/styling` for browser-facing
  shared code such as the clipboard helper and code highlighting; and
  `shared/brand`, which is artwork. Nothing in `shared` may reach `app`,
  `features`, or `platform`.
- **`platform`** owns mechanism at the host boundary, the typed preload bridge
  and the API client, with no product policy.
- **`components/ui`** is the installed Fluid primitive layer. Product code
  consumes it; it consumes nothing from product code.
- **`test`** is the shared test toolkit, described under Validation.

A feature directory that is not declared in `renderer/renderer-architecture.json`
with an owning product area does not exist as far as the gates are concerned.

## Vocabulary

A reviewer should be able to infer a module's role from its name.

- **Port** — an interface declared in a feature's `application` layer naming a
  capability the feature needs. Ports are abstract; they never mention a URL, a
  schema, or `window`.
- **Adapter** — an `infrastructure` factory that implements a Port. Adapters
  own wire validation and translate wire failures into the feature's error
  kinds; they are the only place `@/protocols/*` may be imported.
- **Contract** — a repository module under the repository-root `shared/` that
  the renderer shares with the host process, reached through `@/contracts/*`:
  `account`, `agent-protocol`, `agent-runtime`, `file-formats`, `folder-name`,
  `github-import`, and `html-sanitization`. A Contract is registered in
  `renderer/renderer-architecture.json` and mapped where the renderer meets the
  host, which is a feature Adapter, `platform`, or `app/dependencies.ts`, for
  the same reason a wire schema is. `@/contracts/*` is its own alias precisely
  so that it is not mistaken for `@/shared/*`, which is the renderer's own leaf
  kernel under `renderer/src/shared`.
- **Runtime** — an `application` orchestrator that sequences commands over
  Ports and a store, for example the document runtime and the tabs runtime.
- **`capture()` / `accept()`** — the scope guard a Runtime exposes. A caller
  captures the current scope before awaiting, and the Runtime accepts a
  completion only while that captured scope is still current. Every
  asynchronous completion in the renderer passes through this pair rather than
  through an ad-hoc generation counter.
- **`failureMessage`** — one module per feature, at
  `features/*/application/failure-messages.ts`, that turns a failure kind
  into the sentence a reader sees. Views select recovery by kind and take their
  wording from this module, so a message is written once. The name and the
  layer are both fixed: a reviewer looking for a feature's wording opens one
  path, not three spellings.
- **`FeatureError`** — the single error base in
  `renderer/src/shared/domain/feature-error.ts`. It carries a `name` for the
  failing capability and a `kind` that selects recovery. The shared transport
  kinds are `invalid-response`, `scope-lost`, `unauthorized`, and
  `unavailable`; a feature extends that union with outcomes only it can meet.
- **Registry** — the one table that makes a variant addable in a single place:
  the document-viewer registry in
  `renderer/src/features/documents/ui/source/registry.tsx`, the search backends
  in `renderer/src/features/retrieval/ui/search/backends.ts`. Adding a format
  or a search mode is an entry plus its module; nothing else may test the
  variant by name.

## State Ownership

Three tools, each with one job, and a lifetime attached to every piece of
state.

- **Scoped Zustand vanilla stores** hold domain-session state inside a
  Runtime's `application` layer. A store is constructed and disposed
  explicitly, and its lifetime is a window, a folder, a document, or an Agent
  session rather than the process. Views subscribe through narrow selectors.
- **TanStack Query** holds cacheable server state. Each renderer window owns
  exactly one `QueryClient`, created in `renderer/src/app/providers.tsx`, with
  explicit scoped eviction rather than an unbounded global cache. Suspense is
  reserved for lazy code; an ordinary refresh preserves the content already on
  screen instead of blanking the view.
- **Zod** holds the wire. Every cross-process shape is an executable schema
  under the repository-root `shared/protocols/`, with the wire type inferred
  from the schema rather than declared beside it.

Features share only a reviewed identity kernel and a small recovery-oriented
failure vocabulary. Navigation crosses a feature boundary as a typed intent
that `app` composition resolves, so no router owns workspace state. Session
persistence uses versioned concept-specific adapters rather than whole-store
middleware, and windows reconcile through durable owners rather than renderer
replication; [Renderer Workspace](renderer-workspace.md) owns that contract.

Features reach each other three ways and no others. `app` composition passes
data or a callback between two public feature surfaces. An `app` workflow
coordinates a sequence that spans several features. A feature-agnostic event
carries a notification that implies no ordering. An event never stands in for a
command, a return value, or owned state: a sequence that needs ordering,
authorization, rollback, or recovery has an explicit owner under
`renderer/src/app/workflows/`.

A command that spans features belongs to `app` composition rather than to the
feature that answers it, which is why the command hooks live under
`renderer/src/app/composition/commands/`. Two chords are deliberate exceptions,
held by the feature that owns their verbs: the document feature registers
close, find, and find-again, and the sidebar collapse chord belongs to the
installed primitive. There are no native menu commands in this renderer.

Optimistic updates are limited to reversible low-risk changes, and a rollback
restores the last value the durable owner confirmed rather than whatever the
view held when the write began. An older write that fails after a newer one
started changes nothing.

## Failure Containment

One boundary implementation, `renderer/src/shared/runtime/surface-boundary.tsx`,
has three placements: bootstrap, the shell, and each deferred surface. It
remounts only the failed subtree and every caller supplies its own sentence and
way out, because a leaf cannot reach a feature's failure-message module and a
caught render error's message is written for a developer. A remount below the
shell keeps the runtimes above it; a shell remount does not keep a dirty buffer,
only the snapshots the server already sealed to disk.
[Renderer Workspace](renderer-workspace.md) owns that contract. The renderer
never reloads itself. Actionable recovery stays inline, persistent, or modal
according to its scope: the renderer mounts no
toast layer, and the strip above the workspace
(`renderer/src/app/composition/layout/workspace-notices.tsx`) is where the
window says something the reader did not ask about directly.

Losing the local server has no bounded reconnect. Every renderer query sets
`retry: false`, so recovery is the preparation poll's fixed interval or a
reader-initiated retry. Automatic reconnect is Required and unbuilt; it is
listed under Known Gaps.

## Enforced Rules

Every rule below is enforced by a command, not by review attention. A rule that
cannot be run is not part of this contract.

**Dependency direction — dependency-cruiser (`dependency-cruiser.config.cjs`).**
Twenty rules, all `error`: `no-circular`, `not-to-unresolvable`,
`no-sibling-feature-imports`, `feature-public-entry-only`,
`test-support-is-test-only`, `feature-public-only-from-app`, `domain-is-pure`,
`domain-has-no-node-access`, `application-depends-inward`,
`hooks-have-no-platform-or-view-access`, `ui-has-no-platform-access`,
`infrastructure-has-no-ui-or-app-policy`, `platform-has-no-product-policy`,
`shared-is-a-leaf`, `shared-domain-and-utils-are-pure`,
`kit-does-not-reach-product-code`, `contracts-are-mapped-at-the-boundary`,
`file-format-vocabulary-scope`,
`renderer-does-not-import-implementation-trees`, and
`renderer-does-not-import-electron-runtime`.

The cruiser reads the transpiled graph, where `import type` has been erased, so
it proves the value-level graph only. A Contract is imported for its types more
often than for its values, so the same boundary is held over the source text by
the layout checker below; the cruiser rule is what catches a value import and
what states the boundary in the dependency contract.

**Layout and repository registries — `scripts/renderer/architecture.mjs`.**
`renderer/renderer-architecture.json` is the only feature allowlist, and the
checker holds no second copy to drift from it. Every feature directory is
declared there with its product area; a feature contains only the seven
approved entries (`domain`, `application`, `infrastructure`, `hooks`, `ui`,
`public.ts`, and the optional `test-support.ts`) and always a `public.ts`;
`renderer/src/shared/types` is forbidden; no file references a deleted
implementation tree, `../server/`, or `../electron/`; and no import is
parent-relative, so `./` or `@/` only.

The same file carries the two registries of repository modules the renderer may
reach, and both are checked over the source text, so a type-only import counts.
`wireSchemaModules` covers the executable schemas reached through
`@/protocols/*` and `contractModules` covers the Contracts reached through
`@/contracts/*`. An unregistered module fails; so does reaching a module
registered in one list through the other list's alias. A Contract import
outside the host boundary fails too, with one named exception: the file-format
vocabulary is a vocabulary rather than a transport shape, so
`renderer/src/shared` may restate it.

**Layer purity inside a file — oxlint overrides (`.oxlintrc.json`).** Domain,
application, hooks, and UI each forbid the globals that would let them bypass
their layer (DOM, transports, storage), forbid the imports their layer may not
name, and forbid `@/protocols/*` so wire types are mapped in `infrastructure`.
UI additionally forbids `window.stashbase`, `window.electron`, and
`window.ipcRenderer`. Test files forbid `setTimeout` and `setInterval`, because
a test awaits a condition or uses fake timers, and forbid the `toHaveClass`
matcher except under `renderer/src/components/ui`, where a class is the
primitive's observable contract. `typescript/no-non-null-assertion` is an
error, so `!` never stands in for a narrow. `react/exhaustive-deps` and
`react/rules-of-hooks` are errors: the `correctness` category carries neither,
so without its own entry a conditionally called hook lints clean, which is how
a conditional `useContext` once shipped. Twelve `jsx-a11y` rules are raised to
error beside them and one, `jsx-a11y/prefer-tag-over-role`, is turned off. The
renderer lints with `--deny-warnings`. Two Vitest rules are deliberately off,
`vitest/valid-expect`, which rejects Vitest's supported
`expect(value, message)` form, and `vitest/require-mock-type-parameters`, which
demands a type argument on every mock, while `vitest/expect-expect` stays an
error.

**Compiler strictness — `renderer/tsconfig.json`.**
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`, unused locals and parameters, implicit override, and
switch fall-through are all errors. No `as any`, no `@ts-expect-error`, and no
non-null assertion is accepted. Double casts are confined to the one seam named
under Escape Hatches.

**File size — `scripts/renderer/size.mjs`.** 400 lines per source file and 500
per test file, because a suite past that is two suites. Stories are excluded.
An exception needs an allowlist entry with its own ceiling, and the allowlist
only shrinks: a file that comes back under the limit must lose its entry, and
an entry naming a file that no longer exists fails.

**Conventions the linter cannot express — `scripts/renderer/conventions.mjs`.**
Seventeen pattern checks, each naming the rule it keeps and the one place the
pattern is allowed to live, plus two whole-file rules, the module header and the
design-token gate:

- Colors come from tokens; themes use `light-dark()` rather than `dark:`
  classes; motion uses duration tokens.
- A request signal comes from `useRequestSignals` or a caller. Reading
  `.signal` off an inline controller is forbidden everywhere, and building an
  `AbortController` at all is forbidden in `features/*/hooks` and
  `app/composition`, because those layers receive a signal rather than owning a
  request's lifetime.
- A panel takes a typed view model rather than the return type of a hook; error
  classes extend `FeatureError`; double casts stay at the one approved seam.
- User-facing text comes from the feature's failure-message module. Reading a
  caught error's `message` in `app/**` or a feature's `ui`, `hooks`, or
  `application` layer is forwarding a developer sentence to a reader; only
  `features/*/application/failure-messages.ts` may do it.
- A feature's `test-support.ts` is imported only from a `*.test.*` file. It
  builds a fixture, not a capability, so product code and stories that reach
  for it are shipping test scaffolding.
- A discarded rejection is annotated. Swallowing a rejection needs a
  `// swallowed:` note on the line or the line above saying why the failure is
  safe to drop.
- Search predicates fold with `toLowerCase`. The locale-aware forms match
  differently per machine, so they belong only in a file whose name carries
  `format` or `label`, which is what locale casing is for. Oxlint cannot
  express this, because the receiver is any string rather than a named object.
- Tests assert behavior rather than class names, await conditions rather than
  sleeping, build fixtures from the shared toolkit, and query by role, label,
  or that toolkit. A DOM selector outside `components/ui` tests needs a
  `// dom-contract:` note, for the cases where a third-party editor's own class
  or a data attribute the app publishes really is the contract under test.
- No file carries a lint or type escape hatch, and a source file over 150 lines
  opens with a module header saying what it owns.
- Every custom property declared in `renderer/src/globals.css` has a reader.
  The gate resolves both spellings the renderer uses: a `var()` anywhere in the
  renderer's own TypeScript or CSS, which is what covers a token read by
  another token and a token read inside a utility block, and, for a token
  declared inside the Tailwind theme block, the utility classes Tailwind
  generates from it. A token whose only reader is CSS this repository does not
  own is named in the `tokenConsumers` allowlist with the stylesheet that reads
  it; that list is empty and only shrinks, so an entry naming a token that no
  longer exists is itself a failure.

The two annotated rules are line-scoped: the note has to sit where a reader of
that line will see it, not somewhere else in the file.

**Unused code — knip (`renderer/knip.json`).** Unused files, exports, and
dependencies fail. Tests, stories, and the Storybook config are entries, so a
module reachable only from a test counts as used; the reachability check in
`renderer/src/fluid-registry.test.ts` is what proves product callers for
primitives. Three dependencies are ignored because knip cannot see the caller:
two Storybook addons are named as strings in the Storybook config and loaded
rather than imported, and the shadcn CLI installs a primitive from
`renderer/components.json` by hand and is never reached from source.

**Duplication — jscpd (`renderer/.jscpd.json`).** Clones of 8 lines or 40
tokens across the renderer source, threshold 1%, tests and stories excluded.

**Coverage floor — `renderer/vite.config.ts`.** The floor guards the two pure
layers only, `features/*/domain` and `features/*/application`, at 85% lines,
functions, and statements and 75% branches. A line in those layers is a
decision, and a unit test is the right proof for it. Every other layer is
measured and reported but carries no floor, because a threshold there produces
tests that restate structure rather than protect behavior.

Outside the pure layers a test exists for a reason a reviewer can name: a state
machine or discriminated union, a failure ladder, a scope or lifecycle
invariant, a user-visible path, or a bug that was fixed. File length is not a
reason. `components` is proven by the story accessibility runner, the primitive
reachability check, and the component tests that already exist, each asserting
accessibility; the installed primitives take no further sibling tests.

**Primitive reachability and story accessibility.**
`renderer/src/fluid-registry.test.ts` proves the installed Fluid sources stay
exclusive, that every catalogued component has a Storybook canvas, and that
every primitive is reachable from product code.
`renderer/src/stories.a11y.test.tsx` composes every story in the renderer,
feature stories as well as primitive ones, under the real provider stack and
global CSS, and runs axe over each at the default, compact, and dark
presentations. CI runs no Storybook test runner, so the accessibility
declaration in `renderer/.storybook/preview.tsx` is inert without this suite. A
story's `play` function runs before scoring, so opened and expanded states are
scored too.

## Escape Hatches

Each exemption below is named in the gate that grants it, so removing the
reason removes the entry.

- **Milkdown find seam.**
  `renderer/src/features/documents/ui/markdown/find-controller.ts` may use a
  double cast. Find walks the live DOM the editor renders and paints CSS custom
  highlights; the corpus node and the highlight registry on `window` have no
  shared type with the editor's own. Confining the casts to this file is what
  keeps the rest of the renderer honest.
- **Color literals.** `renderer/src/globals.css` defines the tokens,
  `renderer/src/lib/focus-ring.ts` carries the focus fallback for engines
  without the token, and `renderer/src/shared/brand/logo.tsx` is artwork.
- **`extends Error`.** Only `renderer/src/shared/domain/feature-error.ts`,
  which is the base everything else extends.
- **Class assertions.** `components/ui` tests only, where the class is the
  primitive's contract.
- **Local query clients.** The shared test toolkit only, which is where the
  fixture is built.
- **File size.** None. The allowlist in `scripts/renderer/size.mjs` is empty,
  and the list only shrinks, so an entry cannot come back without a reviewer
  adding it.
- **Raw error messages.** `features/*/application/failure-messages.ts` only,
  the one module per feature whose job is turning a failure into a sentence.
- **Repository Contracts outside the boundary.** The file-format vocabulary in
  `renderer/src/shared`, and nowhere else. It is a vocabulary the renderer's
  own kernel restates, not a transport shape the boundary maps.
- **A feature entry that is not `public.ts`.** `test-support.ts`, imported only
  from a `*.test.*` file.
- **DOM selectors in tests.** `components/ui` tests, plus any line carrying a
  `// dom-contract:` note.
- **Discarded rejections.** Any swallowed rejection whose line, or the line
  above it, carries a `// swallowed:` note.
- **Locale casing.** Files whose name carries `format` or `label`.
- **Design tokens read by third-party CSS.** The `tokenConsumers` allowlist in
  `scripts/renderer/conventions.mjs`, each entry naming the stylesheet that
  reads the token. Empty today.
- **`jsx-a11y/prefer-tag-over-role` is off.** It rejects an ARIA role wherever
  a semantic element could carry it, which reads a status live region and a PDF
  page wrapper as markup mistakes. Turning it on reports 64 findings, none of
  them an accessibility defect the story axe runner or a primitive test can
  see.
- **`unicorn/require-post-message-target-origin` is off for the two broadcast
  tests.** A `BroadcastChannel` post takes no target origin, so the rule is a
  false positive wherever one is exercised and its suggested fix would not
  typecheck. It stays on everywhere else because it still guards the real
  subject, a sandboxed viewer frame's `postMessage`. The two entries are in
  `.oxlintrc.json` rather than as line-level suppressions, which the
  conventions gate forbids.
- **Two Vitest lint rules are off.** One rejects Vitest's supported
  `expect(value, message)` form and the other demands a type argument on every
  mock. Both are jest-shaped and neither protects an invariant this contract
  names.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Feature ownership and repository registries | `renderer/renderer-architecture.json` |
| Composition root | `renderer/src/app/shell.tsx` over `renderer/src/app/composition/`, with `renderer/src/app/bootstrap/startup.tsx` above it |
| Port binding | `renderer/src/app/dependencies.ts`, the one place Adapters are selected for the whole application |
| Cross-feature ordering | `renderer/src/app/workflows/` |
| Window-scoped server cache | `renderer/src/app/providers.tsx` |
| Failure base and kinds | `renderer/src/shared/domain/feature-error.ts` |
| Host boundary | `renderer/src/platform/electron/bridge.ts` and `renderer/src/platform/http/client.ts` |
| Wire schemas | `shared/protocols/electron/`, `shared/protocols/http/`, `shared/protocols/websocket/` |
| Format dispatch | `renderer/src/features/documents/ui/source/registry.tsx` |
| Search backends | `renderer/src/features/retrieval/ui/search/backends.ts` |
| Shared test toolkit | `renderer/src/test`, holding the scoped runtime and isolated query client, semantic queries, element-scoped accessibility assertions, story composition, Port fakes, and the shared environment |
| Boundary enforcement | `dependency-cruiser.config.cjs`, `scripts/renderer/architecture.mjs`, `.oxlintrc.json` |
| Shape enforcement | `scripts/renderer/size.mjs`, `scripts/renderer/conventions.mjs`, `renderer/knip.json`, `renderer/.jscpd.json` |
| Gate runner | `scripts/renderer/check-web.mjs` |
| Path aliases | `renderer/tsconfig.json` `compilerOptions.paths` and `renderer/vite.config.ts` `resolve.alias`, which must stay in sync |

## Validation

From the repository root:

- `pnpm test:renderer-architecture` runs the gate's own tests plus
  dependency-cruiser and the layout checker.
- `pnpm check:renderer-size`, `pnpm check:renderer-conventions`,
  `pnpm check:renderer-unused`, `pnpm check:renderer-dupes`.
- `pnpm lint:web`, `pnpm typecheck:web`, `pnpm test:renderer`,
  `pnpm test:renderer:coverage`, `pnpm build:web`, `pnpm build:storybook`.
- `pnpm test:protocols` proves the wire schemas and their mappings.
- `pnpm check:web` runs the whole gate through `scripts/renderer/check-web.mjs`
  and is the single step CI runs for the renderer in
  `.github/workflows/ci.yml`. Lint, the coverage gate, and the
  production-equivalent Storybook build are inside it, which is why CI has no
  separate step for any of them.

`check-web.mjs` opens by naming every gate it is about to run, then runs each as
its own child process to completion and only then fails. A serial `&&` chain
stops at the first failure and hides every gate behind it, so one run reports
one problem and the next run finds the next. The runner prints a pass or fail
line per gate as it finishes, replays the output of every gate that failed,
names them all in a closing summary, and exits non-zero if any did. The eleven
gates are ordered structure to shape to behavior to build: architecture, size,
conventions, unused, duplication, format, lint, coverage, typecheck, build,
storybook. Storybook closes the list because it builds the same sources a
second way, in the configuration the stories are reviewed in.

The four script gates are themselves tested, because a grep-shaped check fails
silently when its pattern stops matching and a runner that stops early looks
exactly like one that passed. The three checkers each build a temporary tree
and assert the exact sentence the gate reports; the runner's tests drive fake
gate commands and assert it reached every one of them.

## Known Gaps

- **Performance budgets are not established.** Reproducible budgets for bundle
  size, startup stages, key interactions, long tasks, and memory after disposal
  are required by this architecture and no baseline is recorded, so none of
  them gates anything. Startup and interaction behavior is currently reviewed
  by hand.
- **No automated journey instrument.** Journey automation and pixel baselines
  were retired rather than retargeted, so there is no automated proof that the
  application boots, that the application origin serves under the strict
  policy, that the preload bridge authorizes, or that a composition has not
  regressed. [Journey Coverage](journey-coverage.md) defines what stands in its
  place and which journeys are short of decisive evidence.
- **The local server has no bounded reconnect.** Losing it leaves recovery to
  a fixed poll interval or a reader-initiated retry, because every query sets
  `retry: false`.
- **The crash-recovery draft journal shipped against a decision that was never
  formally accepted.** [File Transactions](file-transactions.md) owns that gap.
